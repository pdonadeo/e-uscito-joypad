package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgtype"
	log "github.com/sirupsen/logrus"

	"github.com/bwmarrin/discordgo"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DiscordMessage struct {
	ID           uint `gorm:"primaryKey"`
	GuildID      string
	ChannelID    string
	MessageID    string
	Ts           *time.Time
	AuthorAvatar string
	AuthorName   string
	Content      pgtype.JSONB `gorm:"type:jsonb;default:'{}';not null"`
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
			Name: "Consiglia questo messaggio",
			Type: discordgo.MessageApplicationCommand,
		},
	}

	commandHandlers = map[string]func(s *discordgo.Session, i *discordgo.InteractionCreate){
		"Consiglia questo messaggio": func(s *discordgo.Session, i *discordgo.InteractionCreate) {
			if i.Type == 2 {
				messages := i.ApplicationCommandData().Resolved.Messages

				var lastGuildID string
				var lastChannelID string
				var lastMessageId string
				var lastContent string

				for messageId, m := range messages {
					lastGuildID = i.GuildID
					lastChannelID = m.ChannelID
					lastMessageId = messageId
					lastContent = m.Content

					log.Debugf("messageId = (%s, %s, %s)", lastGuildID, lastChannelID, lastMessageId)
					log.Debugf("message = %v", lastContent)

					err := s.MessageReactionAdd(m.ChannelID, m.ID, "👍")
					if err != nil {
						log.Error(err)
					}
				}

				var dbMessage DiscordMessage

				result := db.Where("guild_id = ? AND channel_id = ? AND message_id = ?", lastGuildID, lastChannelID, lastMessageId).First(&dbMessage)

				//result := db.First(&dbMessage, lastMessageId)
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

	JsonMessage, err := json.Marshal(m)
	if err != nil {
		log.Errorf("Errore convertendo un messaggio Discord in JSON: %s", err)
		return
	}

	message := DiscordMessage{
		GuildID:      m.GuildID,
		ChannelID:    m.ChannelID,
		MessageID:    m.ID,
		Ts:           &m.Timestamp,
		AuthorAvatar: m.Author.AvatarURL("256"),
		AuthorName:   m.Author.Username,
		Content:      pgtype.JSONB{Bytes: JsonMessage, Status: pgtype.Present},
		Consiglio:    false,
	}
	result := db.Create(&message)

	if result.Error != nil {
		log.Error(result.Error)
	}

	log.Debugf("Messaggio JSON: %s", string(JsonMessage))
}
