# Pixel Pond

A Chrome new tab page where pixel-art animals drift across a dark grid behind a glass search box.

- **Seven animals** drawn as ASCII tiles: butterflies, koi, jellyfish, dragonflies, frogs, cranes and crabs, plus a fire dragon and a "Mix" of everything.
- **A living pond:** koi, dragonflies, frogs and crabs wander in random directions; butterflies, jellyfish and cranes travel together across the screen.
- **They react to you:** hover near an animal and it scatters. Click the water to drop food, and koi nearby swim over to eat it.
- **A greeting that follows the clock:** "Good morning / afternoon / evening, *name*", and "Still up, *name*?" from 11 pm to 5 am. Click the name to set your own.
- **Glass search box:** search Google or type a web address, use voice search, Google Lens or AI Mode.
- **Your shortcuts:** filled from your most visited sites at first. Hover a shortcut and click ⋮ to edit or remove it, or use "Add shortcut".
- **Customize panel** (bottom right): pick the animal, how many, pixel size, glow, shortcuts on/off, your name and the greeting font.

## Install

Works in Google Chrome and other Chromium browsers (Microsoft Edge, Brave, Opera).

1. **Get the files.** Either clone the repo:

   ```bash
   git clone https://github.com/HarshPatil30/Pixel_Pond.git
   ```

   or click the green **Code** button on GitHub, choose **Download ZIP**, and unzip it.

2. **Open the extensions page.** Type `chrome://extensions` in the address bar (in Edge: `edge://extensions`).
3. **Turn on Developer mode** with the switch in the top right corner.
4. **Click Load unpacked** and select the **`pixel-pond`** folder inside the project (the folder that contains `manifest.json`, not the outer `Pixel_Pond` folder).
5. **Open a new tab.** Chrome asks once whether you meant to change your new tab page: click **Keep it**.

Keep the folder where it is after loading it. Chrome loads the extension from that folder every time, so moving or deleting it stops the extension from working.

### Optional extras

- **Dark theme to match:** repeat step 4 with the **`pixel-pond-theme`** folder. It turns the tab strip, address bar and bookmarks bar near-black so they blend into the pond. To undo it, go to Settings → Appearance → Theme → **Reset to default**.
- **Hide the bar at the bottom:** Chrome shows a small bar on every new tab page that comes from an extension. Right-click it and choose **Hide footer on New Tab page**, or click **Customize Chrome** and turn off **Show footer on New Tab page**.

## Updating

```bash
cd Pixel_Pond
git pull
```

Then go to `chrome://extensions` and click the **↻ reload** arrow on the **Pixel Pond New Tab** card.

## Uninstall

Go to `chrome://extensions` and click **Remove** on **Pixel Pond New Tab** (and on **Pixel Pond Dark** if you installed the theme). Your normal new tab page comes back straight away.

## Permissions and privacy

The extension asks for three permissions:

| Permission | Why |
|---|---|
| `topSites` | To fill your shortcuts from your most visited sites the first time |
| `search` | So searches go through your default search engine |
| `favicon` | To show each shortcut's icon |

Your settings (name, shortcuts, animal choice) are stored only in your browser. Nothing is sent anywhere, apart from loading the greeting font from Google Fonts and the searches you make.

## Performance

The animals only animate while the new tab is visible; Chrome pauses them as soon as you switch to another tab. If you want to save battery, turn **Glow** off in Customize, since it's the heaviest effect.

## Project layout

```
Pixel_Pond/
├── pixel-pond/            the extension (load this folder)
│   ├── manifest.json
│   ├── newtab.html / .css / .js     page, greeting, search, shortcuts, Customize panel
│   ├── animals-bridge.js            loads the animal engine
│   └── ascii-animals/               animal engine and the seven animals (MIT, see below)
└── pixel-pond-theme/      optional dark Chrome theme
```

## Credits

The seven animals and their renderer come from [ascii-animals](https://github.com/DesignerStephen1/ascii-animals) by drewdi, used under the MIT License (full text in `pixel-pond/ascii-animals/LICENSE.txt`). They were converted from TypeScript to plain JavaScript, and changed so that some animals wander like a pond, everything scatters from a hovering cursor, and koi dart away on hover. Every change is marked `[Pixel Pond change]` in the code.
