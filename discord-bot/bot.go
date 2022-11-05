package main

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	log "github.com/sirupsen/logrus"

	"github.com/bwmarrin/discordgo"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Result struct {
	ID             uint
	DescrizioneTxt string
}

// Variables used for command line parameters
var (
	token string

	pgHost string
	pgPort string
	pgUser string
	pgPass string
	pgDb   string
	db     *gorm.DB
)

func init() {
	var err error

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
	// Client ID:  1038209194089795605
	// Invite URL: Leggi messaggi: 	https://discord.com/api/oauth2/authorize?client_id=1038209194089795605&permissions=1024&scope=bot
	// Invite URL: Invio messaggi: 	https://discord.com/api/oauth2/authorize?client_id=1038209194089795605&permissions=2048&scope=bot
	// Invite URL: Admin: 			https://discord.com/api/oauth2/authorize?client_id=1038209194089795605&permissions=8&scope=bot
	// Invite URL: NIENTE: 			https://discord.com/api/oauth2/authorize?client_id=1038209194089795605&permissions=0&scope=bot

	var result Result
	db.Raw("SELECT id, descrizione_txt FROM backoffice_episodio WHERE id = ?", 12).Scan(&result)
	log.Debug(result.ID)
	log.Debug(result.DescrizioneTxt)

	// Create a new Discord session using the provided bot token.
	dg, err := discordgo.New("Bot " + token)
	if err != nil {
		log.Fatalf("error creating Discord session: %s", err)
	}

	// Register the messageCreate func as a callback for MessageCreate events.
	dg.AddHandler(messageCreate)

	// In this example, we only care about receiving message events.
	dg.Identify.Intents = discordgo.IntentsGuildMessages
	dg.Identify.Intents |= discordgo.IntentMessageContent

	// Open a websocket connection to Discord and begin listening.
	err = dg.Open()
	if err != nil {
		log.Fatalf("error opening connection: %s", err)
	}

	// Wait here until CTRL-C or other term signal is received.
	log.Infof("Bot is now running. Press CTRL-C to exit.")
	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sc

	// Cleanly close down the Discord session.
	dg.Close()
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

	/* // If the message is "ping" reply with "Pong!"
	if m.Content == "ping" {
		s.ChannelMessageSend(m.ChannelID, "Pong!")
	}

	// If the message is "pong" reply with "Ping!"
	if m.Content == "pong" {
		s.ChannelMessageSend(m.ChannelID, "Ping!")
	} */
}
