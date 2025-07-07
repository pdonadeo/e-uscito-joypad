package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strings"
	"syscall"

	log "github.com/sirupsen/logrus"

	"github.com/bwmarrin/discordgo"
)

type DiscordChannel struct {
	ID       string
	channel  *discordgo.Channel
	children map[string]*DiscordChannel
}

type nodeType int

const (
	categoryType nodeType = iota
	channelType
	threadType
)

func (s nodeType) String() string {
	switch s {
	case categoryType:
		return "categoryType"
	case channelType:
		return "channelType"
	case threadType:
		return "threadType"
	default:
		return "unknown"
	}
}

func (s nodeType) MarshalJSON() ([]byte, error) {
	return json.Marshal(s.String())
}

type TreeNode struct {
	GuildID      string      `json:"guildId"`
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Position     int         `json:"position"`
	MessageCount int         `json:"messageCount"`
	NodeType     nodeType    `json:"nodeType"`
	IsRoot       bool        `json:"isRoot"`
	Children     []*TreeNode `json:"children"`
}

type Tree []TreeNode

var (
	token                 string
	guildID               string
	dreamAppHostname      string
	announcementChannelID string
)

func init() {
	token = os.Getenv("DISCORD_BOT_TOKEN")
	guildID = os.Getenv("DISCORD_GUILD_ID")
	dreamAppHostname = os.Getenv("DREAM_APP_HOSTNAME")
	announcementChannelID = os.Getenv("DISCORD_ANNOUNCEMENT_CHANNEL_ID")

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
}

func main() {
	// Invite URL: https://discord.com/api/oauth2/authorize?client_id=1038209194089795605&permissions=8&scope=bot

	// Create a new Discord session using the provided bot token.
	s, err := discordgo.New("Bot " + token)
	if err != nil {
		log.Fatalf("error creating Discord session: %s", err)
	}

	s.AddHandler(guildCreateHandler)

	s.Identify.Intents = discordgo.IntentsGuildMessages
	s.Identify.Intents |= discordgo.IntentMessageContent
	s.Identify.Intents |= discordgo.IntentGuilds

	s.AddHandler(threadCreateHandler)
	s.Identify.Intents = discordgo.IntentsGuilds |
		discordgo.IntentGuildMessages |
		discordgo.IntentGuildMembers |
		discordgo.IntentMessageContent

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
	_ = s.Close()
}

func printChannel(channel *DiscordChannel, thisNode *TreeNode) {
	log.Debugf("    Nome del canale = \"%s\": https://discord.com/channels/%s/%s",
		channel.channel.Name, guildID, channel.channel.ID)

	thirdLevel := make([]*DiscordChannel, 0)
	for _, thread := range channel.children {
		thirdLevel = append(thirdLevel, thread)
	}

	for _, thread := range thirdLevel {
		log.Debugf("        Thread: \"%s\" (%d messaggi): https://discord.com/channels/%s/%s",
			thread.channel.Name, thread.channel.MessageCount, guildID, thread.channel.ID)

		thisNode.Children = append(thisNode.Children, &TreeNode{
			ID:           thread.channel.ID,
			GuildID:      guildID,
			Name:         thread.channel.Name,
			Position:     thread.channel.Position,
			MessageCount: thread.channel.MessageCount,
			NodeType:     threadType,
			IsRoot:       false,
			Children:     make([]*TreeNode, 0),
		})
	}
}

func guildCreateHandler(s *discordgo.Session, event *discordgo.GuildCreate) {
	log.Debugf("Connesso al server: \"%s\", con ID = %s\n", event.Name, event.ID)

	if event.ID == guildID {
		categories_and_root_channels := make(map[string]*DiscordChannel)
		channels := make(map[string]*DiscordChannel)

		// Prima le categorie
		for _, category_or_root_channel := range event.Channels {
			if category_or_root_channel.Type == discordgo.ChannelTypeGuildCategory {
				categories_and_root_channels[category_or_root_channel.ID] = &DiscordChannel{
					ID:       category_or_root_channel.ID,
					channel:  category_or_root_channel,
					children: make(map[string]*DiscordChannel, 0),
				}
			} else if category_or_root_channel.ParentID == "" {
				my_channel := DiscordChannel{
					ID:       category_or_root_channel.ID,
					channel:  category_or_root_channel,
					children: make(map[string]*DiscordChannel, 0),
				}
				channels[category_or_root_channel.ID] = &my_channel
				categories_and_root_channels[category_or_root_channel.ID] = &my_channel
			}
		}

		// Poi i channels veri e propri
		for _, category_or_root_channel := range event.Channels {
			if (category_or_root_channel.Type == discordgo.ChannelTypeGuildText ||
				category_or_root_channel.Type == discordgo.ChannelTypeGuildVoice ||
				category_or_root_channel.Type == discordgo.ChannelTypeGuildNews ||
				category_or_root_channel.Type == discordgo.ChannelTypeGuildPublicThread ||
				category_or_root_channel.Type == discordgo.ChannelTypeGuildForum) &&
				category_or_root_channel.ParentID != "" {
				// Sono i normali channel, e non quello root
				my_channel := DiscordChannel{
					ID:       category_or_root_channel.ID,
					channel:  category_or_root_channel,
					children: make(map[string]*DiscordChannel, 0),
				}
				channels[category_or_root_channel.ID] = &my_channel
				category := categories_and_root_channels[category_or_root_channel.ParentID]
				category.children[category_or_root_channel.ID] = &my_channel
			}
		}

		// Poi i thread
		for _, thread := range event.Threads {
			if thread.Type == discordgo.ChannelTypeGuildPublicThread {
				// Sono i thread pubblici
				parentId := thread.ParentID
				channel := channels[parentId]
				channel.children[thread.ID] = &DiscordChannel{
					ID:       thread.ID,
					channel:  thread,
					children: make(map[string]*DiscordChannel, 0),
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

		tree := make(Tree, 0)
		for _, c := range firstLevel {
			if c.channel.Type == discordgo.ChannelTypeGuildCategory {
				log.Debugf("Nome della categoria = \"%s\" (posizione %d)", c.channel.Name, c.channel.Position)
				node := TreeNode{
					ID:       c.ID,
					GuildID:  guildID,
					Name:     c.channel.Name,
					Position: c.channel.Position,
					NodeType: categoryType,
					IsRoot:   true,
					Children: make([]*TreeNode, 0),
				}

				secondLevel := make([]*DiscordChannel, 0)
				for _, channel := range c.children {
					secondLevel = append(secondLevel, channel)
				}
				sort.Slice(secondLevel, func(i, j int) bool {
					return secondLevel[i].channel.Position < secondLevel[j].channel.Position
				})

				for _, channel := range secondLevel {
					channelNode := TreeNode{
						ID:       channel.ID,
						GuildID:  guildID,
						Name:     channel.channel.Name,
						Position: channel.channel.Position,
						NodeType: channelType,
						IsRoot:   false,
						Children: make([]*TreeNode, 0),
					}

					node.Children = append(node.Children, &channelNode)
					printChannel(channel, &channelNode)
				}
				tree = append(tree, node)
			} else {
				node := TreeNode{
					ID:       c.ID,
					GuildID:  guildID,
					Name:     c.channel.Name,
					Position: c.channel.Position,
					NodeType: channelType,
					IsRoot:   true,
					Children: make([]*TreeNode, 0),
				}
				printChannel(c, &node)
				tree = append(tree, node)
			}
		}

		jsonTree, _ := json.MarshalIndent(tree, "", "  ")
		log.Debugf("\n\n%s\n\n", jsonTree)
		bodyReader := bytes.NewReader(jsonTree)
		url := "http://" + dreamAppHostname + "/api/joycord/channels"
		req, _ := http.NewRequest(http.MethodPost, url, bodyReader)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json, */*;q=0.5")
		req.Header.Set("Origin", "http://"+dreamAppHostname)
		_, _ = http.DefaultClient.Do(req)
	} else {
		return
	}
}

func threadCreateHandler(s *discordgo.Session, t *discordgo.ThreadCreate) {
	thread := t.Channel

	// Ignora i thread archiviati o privati
	if thread == nil || thread.ThreadMetadata == nil || thread.ThreadMetadata.Archived || thread.Type != discordgo.ChannelTypeGuildPublicThread {
		return
	}

	// Recupera il canale padre
	parentChannel, err := s.Channel(thread.ParentID)
	if err != nil {
		log.Warnf("Impossibile ottenere il canale padre del thread: %v", err)
		return
	}

	// Recupera chi ha creato il thread
	var authorName string
	if thread.OwnerID != "" {
		user, err := s.User(thread.OwnerID)
		if err == nil {
			authorName = user.Username
		}
	}
	if authorName == "" {
		authorName = "Qualcuno"
	}

	// Costruisci il messaggio di annuncio
	message := ":loudspeaker: **" + authorName + "** ha creato un nuovo thread: **" + thread.Name + "** nel canale #" + parentChannel.Name + "\n" +
		"https://discord.com/channels/" + thread.GuildID + "/" + thread.ID

	// Invia il messaggio nel canale annunci (sostituisci con l'ID reale)
	_, err = s.ChannelMessageSend(announcementChannelID, message)
	if err != nil {
		log.Warnf("Errore nell'invio del messaggio di annuncio: %v", err)
	}
}
