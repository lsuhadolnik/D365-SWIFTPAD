![Swiftpad Promo](/screenshots/promo.png)

## Summary

D365-Swiftpad is a productivity extension for Dynamics 365 and Power Apps - Just hit `Ctrl+Shift+P` and have all your favourite Power User commands just a few keystrokes away.

It is a continuation of the popular LevelUp tool by Natraj Yegnaraman with
additional commands and a Spotlight style launcher.
Original authorship belongs to Natraj Yegnaraman with updates by Lovro
Suhadolnik.

Documentation for developers is available in [docs/development.md](docs/development.md).
Docs for users hopefully coming soon :)

![Swiftpad Screenshot](/screenshots/Screenshot%20Main.png)

## Notice: Does not work with On-Prem Dynamics CRM.
And there's no plan at the moment to support this.

## Installation

Download the latest build from this repository's [releases](https://github.com/lsuhadolnik/D365-SWIFTPAD/releases) page and unzip it.
Then:

- Go to chrome://extensions
- Enable developer mode
- Click Load Unpacked
- Point to this folder

Then open Dynamics CRM and press `Ctrl+Shift+P`.


Or build it from source...

## Build instructions

Node.js 20 or newer is required. Install dependencies and build using
[Vite](https://vitejs.dev/):

```bash
$ npm install
$ npm run build
```

Lint and format the TypeScript sources with:

```bash
$ npm run lint
```

## Globals

The build tool also defines a variable named `process.env.NODE_ENV` in your scripts. It will be set to `development` unless you use the `--production` option.

**Example:** `./app/background.js`

```javascript
if (process.env.NODE_ENV === 'development') {
  console.log('We are in development mode!');
}
```

### Troubleshooting

If `npm run build` fails with an error like `Cannot find module '...safer-buffer/safer.js'`,
make sure you ran `npm install` before building.

## Credits

- [LevelUp - Natraj Yegnaraman](https://github.com/rajyraman/Levelup-for-Dynamics-CRM)
- [Bob Guidinger's original idea on Impersonation](https://bguidinger.com/blog/user-impersonation-in-unified-interface-apps)
- [Ivan Ficko](https://dynamicsninja.blog/) for PR that added impersonation capability to Level up
- [God mode adapted from original script by Paul Nieuwelaar](https://paulnieuwelaar.wordpress.com/2014/07/30/activate-god-mode-in-crm-2013-dont-let-your-users-see-this/)
- [Customize by Paul Nieuwelaar](https://paulnieuwelaar.wordpress.com/2014/07/28/customize-and-publish-from-crm-2013-forms-with-bookmarklets/)
- [Form Properties by Jared Johnson](http://www.magnetismsolutions.com/blog/jaredjohnson/2014/08/03/dynamics-crm-2013-resurrecting-the-form-properties-window-with-bookmarklet)
- [Minimum values by Ahmed Anwar](http://www.magnetismsolutions.com/blog/ahmed-anwar's-blog/2014/12/8/microsoft-dynamics-crm-2013-populating-required-fields-with-bookmarklets)
- [Display Logical Names adapted from original script by Chris Groh](http://us.hitachi-solutions.com/blog/2014/10/27/showing-entity-logical-names-on-form/)
- [Performance Center by Benjamin John](http://www.leicht-bewoelkt.de/en/dynamics-crm-bookmarklets-v2)
- [Rocket Icon by Jerry Low](https://www.iconfinder.com/jerrylow)
- [Chrome extension kickstart yo generator by HaNdTrix](https://github.com/HaNdTriX/generator-chrome-extension-kickstart)
- [Copy Text to Clipboard by Sindre Sorhus](https://github.com/sindresorhus/copy-text-to-clipboard)
- [Enable/Disable new navigation by Jared Johnson](https://www.magnetismsolutions.com/blog/jaredjohnson/2018/11/27/dynamics-365-v9-1-enable-unified-interface-ui-updates-on-upgraded-organizations)
- [Chrome Extension Yeoman Generator](https://github.com/mazamachi/generator-chrome-extension-kickstart-typescript)
