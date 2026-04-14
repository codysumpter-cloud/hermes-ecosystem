---
title: "How to Set Up Hermes on Telegram"
source: "https://x.com/neoaiforecast/status/2042174650340536700?s=12"
author:
  - "[[@neoaiforecast]]"
published: 2026-04-09
created: 2026-04-14
description: "Most people think “Telegram bot” and imagine a lightweight chatbot.That is not the right mental model for Hermes.When you set up Hermes on T..."
tags:
  - "clippings"
---
![Image](https://pbs.twimg.com/media/HFc9zBXbEAAaIOd?format=jpg&name=large)

Most people think “Telegram bot” and imagine a lightweight chatbot.

That is not the right mental model for Hermes.

When you set up Hermes on Telegram, you are not just connecting a bot to a messaging app. You are extending Hermes’s gateway so the agent can operate as a persistent remote-control surface from your phone, desktop, or team chats.

That distinction matters.

Because once Telegram is wired in properly, Hermes stops feeling like something trapped in a terminal window and starts feeling like an agent you can supervise from anywhere.

## Why setting up Telegram matters in Hermes

Telegram is one of the clearest examples of what makes Hermes different from a normal assistant.

In the docs, Telegram is not treated like a bolt-on notification channel. It is treated like a serious operator surface.

That means you can:

- continue work away from the terminal
- receive cron and scheduled-task output in chat
- approve risky actions from Telegram
- switch models inside Telegram
- separate projects into isolated sessions and topics
- use the same agent across CLI and mobile contexts

Takeaway: Telegram is where Hermes starts to feel like a durable agent you can supervise from anywhere.

## Start with the simplest path

The shortest path is:

1. Create a bot in BotFather
2. Get your numeric Telegram user ID
3. Run hermes gateway setup
4. Start the gateway with hermes gateway
5. Message the bot in a DM and confirm it responds

That flow gets you from zero to a working Telegram-connected Hermes instance quickly, without forcing you to understand every gateway feature on day one.

Takeaway: prove the private DM path first, then expand.

## Step 1: Create the bot with BotFather

Every Telegram setup starts with BotFather.

You create a new bot, choose a display name, choose a unique username ending in “bot,” and copy the token BotFather gives you.

That token is what Hermes uses to connect to Telegram.

It is effectively the gateway credential for your bot, which means it should be treated like an API key. If it leaks, revoke it immediately and issue a new one.

Takeaway: the Telegram token is the gateway credential. Protect it like any other secret.

## Step 2: Get your numeric Telegram user ID

Hermes does not use your [@username](https://x.com/@username) for access control.

It uses your numeric Telegram user ID.

The official docs recommend messaging [@userinfobot](https://x.com/@userinfobot) to get it instantly. That number is what you place in TELEGRAM\_ALLOWED\_USERS so Hermes knows who is authorized to talk to the bot.

**This is one of the most important pieces of the setup, because it is the difference between a private personal bot and something accidentally exposed.**

Takeaway: usernames are for people; numeric user IDs are for security.

## Step 3: Configure Hermes the easy way

The easiest beginner path is:

**hermes gateway setup**

Choose Telegram, paste your bot token, and enter your allowed user ID when prompted.

If you prefer the manual route, the core configuration is still very small. In ~/.hermes/.env, you add:

```markdown
TELEGRAM_BOT_TOKEN=123456...wxYZ
TELEGRAM_ALLOWED_USERS=123456789
```

Then start the gateway:

**hermes gateway**

If the bot comes online and replies in your DM, the core Telegram setup is done.

Takeaway: the setup is conceptually simple token, allowlist, gateway process.

## Understand the gateway mental model

The Hermes gateway is not just a message relay.

It is the transport and session layer that lets one agent operate across multiple surfaces.

On Telegram, that shows up as:

- DMs for direct work
- groups for shared use
- a home channel for cron delivery
- persistent sessions tied to chats and topics
- operator controls like approvals, reactions, and model switching

That is why Telegram matters so much in Hermes. It makes the agent reachable without flattening it into a stateless bot.

Takeaway: the gateway is part of how Hermes preserves continuity outside the CLI.

## Set a home channel early

If you plan to use cron jobs, recurring briefings, or proactive notifications, set a home channel early. The easiest path is to use /sethome inside the Telegram chat where you want scheduled results to appear.

You can also define it manually with env vars like:

```markdown
TELEGRAM_HOME_CHANNEL=-1001234567890
TELEGRAM_HOME_CHANNEL_NAME="My Notes"
```

This matters because scheduled jobs need a destination. Without a home channel, the automation story is incomplete.

Takeaway: if Telegram is your control layer, the home channel is your delivery inbox.

## Avoid the biggest Telegram mistake

The most common Telegram failure mode is not Hermes.

It is Telegram privacy mode.

By default, Telegram bots in groups have privacy mode enabled. When that is on, the bot cannot see normal group chatter. It mostly sees slash commands, replies to its own messages, and a few special message types.

If you want the bot to behave more naturally in groups, you have two choices:

- disable privacy mode in BotFather
- or make the bot a group admin

There is one operational gotcha that matters a lot: after changing privacy mode, you must remove and re-add the bot to the group. Telegram caches the old privacy state when the bot joins.

Hermes also gives you a better group interaction model with telegram.require\_mention: true, so the bot responds only when directly triggered instead of reacting to every visible message.

Takeaway: most “Hermes is broken in Telegram groups” problems are actually Telegram privacy-mode problems.

## Why Telegram is more than a bot endpoint

This is where Hermes starts to separate from ordinary bots.

The Telegram integration supports:

- inline /model switching with an interactive picker
- approval flows for potentially dangerous commands
- emoji reactions for processing feedback
- voice-message transcription
- TTS replies as native voice bubbles
- scheduled-task delivery
- topic-based session isolation

These are not cosmetic features.

They reduce how often you need to jump back into the terminal. Telegram becomes a supervision layer for real work, not just a place to ask one-off questions.

Takeaway: the best Hermes Telegram setup is not a passive Q&A bot. It is a control surface for ongoing agent work.

## Use topics to separate workstreams

One of the highest-signal upgrades in the latest Hermes Telegram docs is support for private chat topics in DMs.

That means a single one-on-one chat with Hermes can contain multiple isolated workspaces such as:

- Website
- Research
- General

Each topic gets its own session, history, and context. Hermes can even auto-load a skill for a topic, so one topic can behave like a research workspace while another behaves like a coding workspace.

Group forum topics can also bind to skills, which makes team setups much cleaner. For example:

- Research topic > arxiv
- Engineering topic > software-development
- General topic > no skill, general-purpose behavior

This is a big deal because it turns Telegram from “one long chat thread” into something much closer to a multi-workspace console.

Takeaway: topics make Telegram feel like a structured agent workspace, not just a messaging thread.

## Add team access only after solo works

If you want to build a team Telegram assistant, Hermes supports two models:

- static allowlists
- DM pairing

Static allowlists are simple. Add multiple numeric user IDs to TELEGRAM\_ALLOWED\_USERS.

DM pairing is more dynamic. A teammate messages the bot, gets a one-time pairing code, and you approve it from the server with a command like:

**hermes pairing approve telegram XAGD5N7P**

That is a better workflow for teams because you do not need to collect everyone’s user ID upfront or keep restarting the gateway every time access changes.

But it still makes sense to get the solo DM path working first.

Takeaway: prove the personal setup first, then scale into team access.

## The practical beginner setup

If I were explaining the cleanest Telegram path to a new Hermes user, I would keep it this simple:

1. Install Hermes locally or on a VPS
2. Create the bot in BotFather
3. Get your numeric Telegram user ID
4. Run hermes gateway setup
5. Start hermes gateway
6. Test the bot in a DM
7. Set /sethome
8. Only then add groups, cron, topics, pairing, or webhooks

That order matters because it keeps Telegram quirks from getting confused with Hermes issues.

Takeaway: start with one private DM that works, then expand the surface area deliberately.

## Final Thoughts

Hermes becomes much more compelling when messaging is part of the operating model.

Telegram is the easiest place to see that clearly.

It gives Hermes reachability, session continuity, approvals, proactive delivery, mobile supervision, and a real remote-control surface. That creates a very different product feeling from a browser-only assistant or a local-only CLI tool.

Takeaway: Telegram is not just another Hermes integration. It is one of the clearest expressions of the Hermes gateway model.