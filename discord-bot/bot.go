package main

import (
	"fmt"
	"os"
	"os/signal"
	"sort"
	"strings"
	"syscall"

	log "github.com/sirupsen/logrus"

	"github.com/bwmarrin/discordgo"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DiscordChannel struct {
	ID      string
	channel *discordgo.Channel
	sons    map[string]*DiscordChannel
}

var (
	applicationId string
	token         string
	guildID       string

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
)

func init() {
	var err error

	applicationId = os.Getenv("DISCORD_APPLICATION_ID")
	token = os.Getenv("DISCORD_BOT_TOKEN")
	guildID = os.Getenv("DISCORD_GUILD_ID")

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

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		pgHost, pgPort, pgUser, pgPass, pgDb)
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

	log.Infof("Adding commands...")
	registeredCommands := make([]*discordgo.ApplicationCommand, len(commands))
	for i, v := range commands {
		cmd, err := s.ApplicationCommandCreate(applicationId, "", v)
		if err != nil {
			log.Fatalf("Cannot create '%v' command: %v", v.Name, err)
		}
		registeredCommands[i] = cmd
	}

	s.AddHandler(guildCreateHandler)

	s.Identify.Intents = discordgo.IntentsGuildMessages
	s.Identify.Intents |= discordgo.IntentMessageContent
	s.Identify.Intents |= discordgo.IntentGuilds

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

func printChannel(channel *DiscordChannel) {
	log.Debugf("    Nome del canale = \"%s\": https://discord.com/channels/%s/%s",
		channel.channel.Name, guildID, channel.channel.ID)

	thirdLevel := make([]*DiscordChannel, 0)
	for _, thread := range channel.sons {
		thirdLevel = append(thirdLevel, thread)
	}

	for _, thread := range thirdLevel {
		log.Debugf("        Thread: \"%s\" (%d messaggi): https://discord.com/channels/%s/%s",
			thread.channel.Name, thread.channel.MessageCount, guildID, thread.channel.ID)
	}
}

func guildCreateHandler(s *discordgo.Session, event *discordgo.GuildCreate) {
	log.Debugf("Connesso al server: \"%s\", con ID = %s\n", event.Name, event.ID)

	if event.ID == guildID {
		categories_and_root_channels := make(map[string]*DiscordChannel)
		channels := make(map[string]*DiscordChannel)

		// Prima le categorie
		for _, category_or_root_channel := range event.Guild.Channels {
			if category_or_root_channel.Type == discordgo.ChannelTypeGuildCategory {
				categories_and_root_channels[category_or_root_channel.ID] = &DiscordChannel{
					ID:      category_or_root_channel.ID,
					channel: category_or_root_channel,
					sons:    make(map[string]*DiscordChannel, 0),
				}
			} else if category_or_root_channel.ParentID == "" {
				my_channel := DiscordChannel{
					ID:      category_or_root_channel.ID,
					channel: category_or_root_channel,
					sons:    make(map[string]*DiscordChannel, 0),
				}
				channels[category_or_root_channel.ID] = &my_channel
				categories_and_root_channels[category_or_root_channel.ID] = &my_channel
			}
		}

		// Poi i channels veri e propri
		for _, category_or_root_channel := range event.Guild.Channels {
			if (category_or_root_channel.Type == discordgo.ChannelTypeGuildText ||
				category_or_root_channel.Type == discordgo.ChannelTypeGuildVoice ||
				category_or_root_channel.Type == discordgo.ChannelTypeGuildNews ||
				category_or_root_channel.Type == discordgo.ChannelTypeGuildPublicThread ||
				category_or_root_channel.Type == discordgo.ChannelTypeGuildForum) &&
				category_or_root_channel.ParentID != "" {
				// Sono i normali channel, e non quello root
				my_channel := DiscordChannel{
					ID:      category_or_root_channel.ID,
					channel: category_or_root_channel,
					sons:    make(map[string]*DiscordChannel, 0),
				}
				channels[category_or_root_channel.ID] = &my_channel
				category := categories_and_root_channels[category_or_root_channel.ParentID]
				category.sons[category_or_root_channel.ID] = &my_channel
			}
		}

		// Poi i thread
		for _, thread := range event.Guild.Threads {
			if thread.Type == discordgo.ChannelTypeGuildPublicThread {
				// Sono i thread pubblici
				parentId := thread.ParentID
				channel := channels[parentId]
				channel.sons[thread.ID] = &DiscordChannel{
					ID:      thread.ID,
					channel: thread,
					sons:    make(map[string]*DiscordChannel, 0),
				}
			}
		}

		firstLevel := make([]*DiscordChannel, 0)
		for _, c := range categories_and_root_channels {
			firstLevel = append(firstLevel, c)
		}
		sort.Slice(firstLevel, func(i, j int) bool {
			return firstLevel[i].channel.Position < firstLevel[j].channel.Position
		})

		for _, c := range firstLevel {
			if c.channel.Type == discordgo.ChannelTypeGuildCategory {
				log.Debugf("Nome della categoria = \"%s\" (posizione %d)", c.channel.Name, c.channel.Position)

				secondLevel := make([]*DiscordChannel, 0)
				for _, channel := range c.sons {
					secondLevel = append(secondLevel, channel)
				}
				sort.Slice(secondLevel, func(i, j int) bool {
					return secondLevel[i].channel.Position < secondLevel[j].channel.Position
				})

				for _, channel := range secondLevel {
					printChannel(channel)
				}
			} else {
				printChannel(c)
			}
		}
	} else {
		return
	}
}
