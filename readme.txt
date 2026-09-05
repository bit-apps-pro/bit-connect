=== Bit Connect ===
Contributors: bitpressadmin, khoaiz
Tags: forum, community, feedback, roadmap, feature requests
Requires at least: 6.8
Tested up to: 7.0
Requires PHP: 8.2
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A community forum for WordPress where users raise feature requests, report issues, send feedback and vote on what gets built next.

== Description ==

Bit Connect turns your site into a public product forum. Your users open topics for feature requests, bug reports and feedback; everyone else upvotes and comments; and you move each topic through the stages of your roadmap so people can see what you are actually building.

= What you get =

* **Topics your users create** — feature requests, issues and feedback, organised by topic type, product/department and tags.
* **Upvotes and comments** — let the community show you what matters most, and discuss it in the open.
* **A roadmap in stages** — move topics through the stages you define, so progress is visible without you writing an update post.
* **A front-end portal** — served at your site root or on a page of its own, with server-side rendering and SEO metadata so topics are indexable.
* **Roles and capabilities** — a per-role capability matrix decides who can post, comment, vote and moderate.
* **Email notifications** — tell members when their topic moves, when someone replies, or when a moderator steps in.
* **Reports and moderation** — members flag content, moderators review it, and content can auto-hide once enough people report it.

= Pro add-on =

Some features are provided by a separate **Bit Connect Pro** add-on, which is not hosted on WordPress.org. Everything described above works in this plugin without it. See [bitapps.pro/bit-connect](https://bitapps.pro/bit-connect) for what the add-on adds.

== Development ==

The compiled JavaScript and CSS under `assets/` are built from the TypeScript and React sources in this plugin's public repository:

* Source: [github.com/Bit-Apps-Pro/bit-connect](https://github.com/Bit-Apps-Pro/bit-connect)
* Build: `composer install && pnpm install && pnpm build:free`
* Needs: PHP 8.2+, Node 20+, pnpm 9+ and Composer 2. Nothing else — no private registry, credential, submodule or configuration file is involved, and a plain clone of the repository builds as it stands.

The build is [Vite](https://vitejs.dev) with the entry points named in `vite.config.mts` (admin) and `vite.config.client.mts` (portal); `pnpm build:free` writes the admin bundle to `assets/`, the portal bundle to `assets/client/` and its server-rendered HTML to `assets/client/ssr/`. PHP dependencies are namespaced at install time by [Imposter](https://github.com/TypistTech/imposter-plugin).

== External Services ==

This plugin relies on two external services: Google Fonts, for the typeface the forum is set in, and the Bit Apps API. Neither receives your site's content, your members' details or your settings. What each one does, and when, is set out below.

= Google Fonts =

The plugin loads the **Outfit** typeface from Google Fonts, on both its admin screens and the public forum portal. Because the portal is public, this happens for **every visitor** who views it, not only for logged-in administrators.

* **What is sent:** the request for the font files themselves. As with any web request, Google receives the visitor's IP address, browser user agent and the referring page URL. No site content, member details or settings are transmitted.
* **When:** on every page load of the forum portal and of the plugin's admin screens.
* **Endpoints:** `https://fonts.googleapis.com` (stylesheet) and `https://fonts.gstatic.com` (font files).
* **Provider:** Google — [terms of service](https://policies.google.com/terms), [privacy policy](https://policies.google.com/privacy).

If serving fonts from Google is not acceptable for your site — some jurisdictions treat it as a transfer of visitor data — the font is purely cosmetic and the forum works without it.

= Bit Apps plugin catalogue =

On the **Bit Connect → License & Support** screen, your browser requests `https://wp-api.bitapps.pro/public/plugins-info` to display the plugin's current version and the list of other Bit Apps plugins shown on that page.

* **What is sent:** nothing beyond an ordinary web request. No site content, user data, email addresses or settings are transmitted. As with any web request, the receiving server sees your IP address and the referring admin URL.
* **When:** only while the License & Support screen is open. Never on the front end, and never on other admin screens.
* **Provider:** Bit Apps — [terms of service](https://bitapps.pro/terms-of-service/), [privacy policy](https://bitapps.pro/privacy-policy/).

= Optional diagnostic reporting =

Separately, the plugin can send diagnostic data to Bit Apps to help improve it. This is **off by default**. Nothing is sent unless you opt in — including if you decline: refusing the invitation stores your answer locally and makes no request at all. You opt in either from the one-time notice or from the *Improvement* toggle on the License & Support screen, and you can turn it back off there at any time.

* **What is sent, if you opt in:** your site URL and name, WordPress and server versions, your site's language, the number of registered users, and the number of active and inactive plugins. Alongside that, a description of how the forum itself is set up and used: where the portal is served from, whether it is open to everyone or to members only, how people sign in, how many topics, replies, votes, follows and reports exist, how many terms each vocabulary holds, how many roles take part in or moderate the forum, which notification channels and SEO options are switched on, and whether the Pro add-on is present.
* **What is never sent:** your email address, your name, any member's details, any IP address, and any content — no topic, reply, comment or setting value beyond the on/off states listed above.
* **When:** on opt-in, and weekly thereafter. Never on the front end.
* **Endpoint:** `https://wp-api.bitapps.pro/public/`.
* **Provider:** Bit Apps — [terms of service](https://bitapps.pro/terms-of-service/), [privacy policy](https://bitapps.pro/privacy-policy/).

== Installation ==

= Automated Installation =

Installation is free, quick, and easy. Simply search for **Bit Connect** in your WordPress dashboard under Plugins → Add New, then install and activate it.

= Manual Alternatives =

Alternatively, you can download the plugin zip file from [wp.org](https://wordpress.org), upload it via the **Plugins → Add New → Upload Plugin** option, and follow the on-screen instructions.

== Frequently Asked Questions ==

= Where can I get support or help? =

- [Live Chat Support](https://tawk.to/chat/60eac4b6d6e7610a49aab375/1faah0r3e)
- [Facebook Community](https://www.facebook.com/groups/3308027439209387)

= Do I need the Pro add-on? =

No. Bit Connect is a complete forum on its own. The Pro add-on is a separate plugin that adds further features; nothing described in this readme depends on it.

= Does the plugin contact any external servers? =

Two, both described under *External Services* above: Google Fonts, which serves the typeface on the portal and the admin screens, and the Bit Apps API, which is contacted only from the License & Support screen. Diagnostic reporting is separate, off by default, and sends nothing at all until you opt in — declining makes no request either.

== Other plugins by Bit Apps ==

[Bit Integrations](https://bit-integrations.com): Automate 290+ platforms and Contact Form 7, Elementor Form, WooCommerce, Google Sheet, wpforms, Forminator, BuddyBoss, LearnDash, Hubspot, Mail poet, MailChimp, Webhook, ACF, Zapier, Fluent CRM, Forms, CRM, LMS, Membership & many more.

[Bit Form](https://bit-form.com): – Advanced, Super Fast, lightweight, Drag & drag-and-drop form builder for WordPress. Users can create Multi-Step forms, Conversational forms, Payment Form & more.

[Bit Social](https://bit-social.com): – Auto Post, Schedule & Share WordPress post to Facebook, LinkedIn, Twitter with Bit Social Auto Poster. Scheduling & sharing posts on social media easily.

[Bit Assist](https://bitapps.pro/bit-assist): Connect all your support assistants in a single button. Floating Chat Widget, Contact Chat Icons, Telegram Chat, Line Messenger, WeChat, WhatsApp, Email, SMS, Call Button & more.

[Bit File Manager](https://bitapps.pro/bit-file-manager/): – 100% free WordPress file manager plugin.

[Bit SMTP](https://bitapps.pro/bit-smtp/): – 100% free WordPress SMTP plugin.

[Webhook.is](https://webhook.is): – Test your incoming webhook response & send outgoing webhook requests for free.

== Changelog ==

= 1.0.0 =
* First stable release.
* Split into two editions: the free plugin, and Bit Connect Pro as a separate add-on.

= 0.1.0 =
* Initial Beta release

