package main

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	log "github.com/sirupsen/logrus"

	"github.com/bwmarrin/discordgo"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DiscordMessage struct {
	ID           string `gorm:"primaryKey"`
	Ts           *time.Time
	AuthorAvatar string
	AuthorName   string
	Content      string
	Consiglio    bool
}

func (DiscordMessage) TableName() string {
	return "backoffice_discordmessage"
}

var (
	applicationId string
	token         string

	pgHost string
	pgPort string
	pgUser string
	pgPass string
	pgDb   string

	db *gorm.DB

	commands = []*discordgo.ApplicationCommand{
		{
			Name: "consiglio",
			Type: discordgo.MessageApplicationCommand,
		},
	}

	commandHandlers = map[string]func(s *discordgo.Session, i *discordgo.InteractionCreate){
		"consiglio": func(s *discordgo.Session, i *discordgo.InteractionCreate) {
			if i.Type == 2 {
				messages := i.ApplicationCommandData().Resolved.Messages

				var lastContent string
				var lastMessageId string
				for messageId, m := range messages {
					lastMessageId = messageId
					lastContent = m.Content
					log.Debugf("messageId = %s", messageId)
					log.Debugf("message = %v", lastContent)

					err := s.MessageReactionAdd(m.ChannelID, m.ID, "👍")
					if err != nil {
						log.Error(err)
					}
				}

				var dbMessage DiscordMessage
				result := db.First(&dbMessage, lastMessageId)
				if result.Error != nil {
					log.Error(result.Error)
				} else {
					dbMessage.Consiglio = true
					result = db.Save(&dbMessage)
					if result.Error != nil {
						log.Error(result.Error)
					}
				}

				s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
					Type: discordgo.InteractionResponseChannelMessageWithSource,
					Data: &discordgo.InteractionResponseData{
						Content: "Grazie per il consiglio! :heart:",
						Flags:   discordgo.MessageFlagsEphemeral,
					},
				})
			}
		},
	}
)

func init() {
	var err error

	applicationId = os.Getenv("DISCORD_APPLICATION_ID")
	token = os.Getenv("DISCORD_BOT_TOKEN")

	pgHost = os.Getenv("PGHOST")
	pgPort = os.Getenv("PGPORT")
	pgUser = os.Getenv("PGUSER")
	pgPass = os.Getenv("PGPASSWORD")
	pgDb = os.Getenv("PGDATABASE")

	debug := strings.ToLower(os.Getenv("DEBUG"))

	log.SetOutput(os.Stdout)

	log.SetFormatter(&log.TextFormatter{
		DisableColors: false,
		FullTimestamp: true,
	})

	if debug == "true" {
		log.SetLevel(log.DebugLevel)
	} else {
		log.SetLevel(log.InfoLevel)
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", pgHost, pgPort, pgUser, pgPass, pgDb)
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("Error connecting to PostgreSQL: ", err)
	}
}

func main() {
	// Invite URL: https://discord.com/api/oauth2/authorize?client_id=1038209194089795605&permissions=2147484736&scope=bot
	// Invite URL: https://discord.com/api/oauth2/authorize?client_id=1038209194089795605&permissions=8&scope=bot

	// Create a new Discord session using the provided bot token.
	s, err := discordgo.New("Bot " + token)
	if err != nil {
		log.Fatalf("error creating Discord session: %s", err)
	}

	s.AddHandler(func(s *discordgo.Session, i *discordgo.InteractionCreate) {
		if h, ok := commandHandlers[i.ApplicationCommandData().Name]; ok {
			h(s, i)
		}
	})

	log.Infof("Adding commands...")
	registeredCommands := make([]*discordgo.ApplicationCommand, len(commands))
	for i, v := range commands {
		cmd, err := s.ApplicationCommandCreate(applicationId, "", v)
		if err != nil {
			log.Fatalf("Cannot create '%v' command: %v", v.Name, err)
		}
		registeredCommands[i] = cmd
	}

	// Register the messageCreate func as a callback for MessageCreate events.
	s.AddHandler(messageCreate)

	// In this example, we only care about receiving message events.
	s.Identify.Intents = discordgo.IntentsGuildMessages
	s.Identify.Intents |= discordgo.IntentMessageContent

	// Open a websocket connection to Discord and begin listening.
	err = s.Open()
	if err != nil {
		log.Fatalf("error opening connection: %s", err)
	}

	// Wait here until CTRL-C or other term signal is received.
	log.Infof("Bot is now running. Press CTRL-C to exit.")
	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sc

	// Cleanly close down the Discord session.
	s.Close()
}

// This function will be called (due to AddHandler above) every time a new
// message is created on any channel that the authenticated bot has access to.
func messageCreate(s *discordgo.Session, m *discordgo.MessageCreate) {
	log.Debugf("Ho ricevuto un messaggio da \"%s\": |||%s|||\n", m.Author.AvatarURL("256"), m.Content)

	// Ignore all messages created by the bot itself
	// This isn't required in this specific example but it's a good practice.
	if m.Author.ID == s.State.User.ID {
		return
	}

	message := DiscordMessage{
		ID:           m.ID,
		Ts:           &m.Timestamp,
		AuthorAvatar: m.Author.AvatarURL("256"),
		AuthorName:   m.Author.Username,
		Content:      m.Content,
		Consiglio:    false,
	}
	result := db.Create(&message)

	if result.Error != nil {
		log.Error(result.Error)
	}

	log.Debug("==================================================================")
	log.Debugf("ID = %s", m.ID)
	log.Debugf("m.Timestamp = %s", m.Timestamp)
	log.Debugf("m.Author.AvatarURL(\"256\") = %s", m.Author.AvatarURL("256"))
	log.Debugf("m.Author.Username = %s", m.Author.Username)
	log.Debugf("m.Content = %s", m.Content)
	log.Debug("------------------------------------------------------------------")

	if strings.HasPrefix(m.Content, "!consiglio") {
		log.Debug("Ho ricevuto un comando di consiglio")
		err := s.MessageReactionAdd(m.ChannelID, m.ID, "👍")
		if err != nil {
			log.Error(err)
		}
	}
}
