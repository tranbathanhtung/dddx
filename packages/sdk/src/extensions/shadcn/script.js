(function () {
  /*__THEMES__*/

  var STYLE_ID = "ddd-preview-theme";
  var FONT_LINK_ID = "ddd-preview-theme-fonts";
  var PANEL_TAG = "ddd-shadcn-panel";

  var BASE62 =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  var BASE_COLOR_NAMES = [
    "neutral",
    "stone",
    "zinc",
    "gray",
    "mauve",
    "olive",
    "mist",
    "taupe",
  ];

  var PRESET_STYLES = [
    "nova",
    "vega",
    "maia",
    "lyra",
    "mira",
    "luma",
    "sera",
    "rhea",
  ];

  var STYLES = PRESET_STYLES.map(function (id) {
    return { id: id, label: id.charAt(0).toUpperCase() + id.slice(1) };
  });

  var PRESET_THEMES = [
    "neutral",
    "stone",
    "zinc",
    "gray",
    "amber",
    "blue",
    "cyan",
    "emerald",
    "fuchsia",
    "green",
    "indigo",
    "lime",
    "orange",
    "pink",
    "purple",
    "red",
    "rose",
    "sky",
    "teal",
    "violet",
    "yellow",
    "mauve",
    "olive",
    "mist",
    "taupe",
  ];

  var PRESET_FONTS = [
    "inter",
    "noto-sans",
    "nunito-sans",
    "figtree",
    "roboto",
    "raleway",
    "dm-sans",
    "public-sans",
    "outfit",
    "jetbrains-mono",
    "geist",
    "geist-mono",
    "lora",
    "merriweather",
    "playfair-display",
    "noto-serif",
    "roboto-slab",
    "oxanium",
    "manrope",
    "space-grotesk",
    "montserrat",
    "ibm-plex-sans",
    "source-sans-3",
    "instrument-sans",
    "eb-garamond",
    "instrument-serif",
  ];

  var PRESET_FONT_HEADINGS = ["inherit"].concat(PRESET_FONTS);

  var V1_CHART_COLOR_MAP = {
    neutral: "blue",
    stone: "lime",
    zinc: "amber",
    gray: "amber",
    mauve: "emerald",
    olive: "violet",
    mist: "rose",
    taupe: "cyan",
  };

  var RADII = [
    { id: "default", label: "Default", value: "" },
    { id: "none", label: "None", value: "0" },
    { id: "small", label: "Small", value: "0.45rem" },
    { id: "medium", label: "Medium", value: "0.625rem" },
    { id: "large", label: "Large", value: "0.875rem" },
  ];

  var STYLE_SURFACES = {
    vega: { radius: "0.625rem", letterSpacing: "0em", cardGap: "1rem", cardPy: "1rem" },
    nova: { radius: "0.45rem", letterSpacing: "0em", cardGap: "0.75rem", cardPy: "0.875rem" },
    maia: { radius: "0.875rem", letterSpacing: "0em", cardGap: "1.5rem", cardPy: "1.75rem" },
    lyra: { radius: "0", letterSpacing: "0.02em", cardGap: "0.75rem", cardPy: "1rem" },
    mira: { radius: "0.375rem", letterSpacing: "0em", cardGap: "0.625rem", cardPy: "0.75rem" },
    luma: { radius: "0.75rem", letterSpacing: "0.01em", cardGap: "1.25rem", cardPy: "1.25rem" },
    sera: { radius: "0.625rem", letterSpacing: "0.015em", cardGap: "1rem", cardPy: "1rem" },
    rhea: { radius: "0.45rem", letterSpacing: "0.01em", cardGap: "0.75rem", cardPy: "0.875rem" },
  };

  var TAILWIND_COLOR_KEYS = [
    "background",
    "foreground",
    "card",
    "card-foreground",
    "popover",
    "popover-foreground",
    "primary",
    "primary-foreground",
    "secondary",
    "secondary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "accent-foreground",
    "destructive",
    "border",
    "input",
    "ring",
    "chart-1",
    "chart-2",
    "chart-3",
    "chart-4",
    "chart-5",
    "sidebar",
    "sidebar-foreground",
    "sidebar-primary",
    "sidebar-primary-foreground",
    "sidebar-accent",
    "sidebar-accent-foreground",
    "sidebar-border",
    "sidebar-ring",
  ];

  var FONTS = [
    { id: "geist", label: "Geist", family: "'Geist Variable', system-ui, sans-serif", google: "Geist" },
    { id: "inter", label: "Inter", family: "Inter, system-ui, sans-serif", google: "Inter" },
    { id: "noto-sans", label: "Noto Sans", family: "'Noto Sans Variable', system-ui, sans-serif", google: "Noto Sans" },
    { id: "nunito-sans", label: "Nunito Sans", family: "'Nunito Sans Variable', system-ui, sans-serif", google: "Nunito Sans" },
    { id: "figtree", label: "Figtree", family: "'Figtree Variable', system-ui, sans-serif", google: "Figtree" },
    { id: "roboto", label: "Roboto", family: "'Roboto Variable', system-ui, sans-serif", google: "Roboto" },
    { id: "raleway", label: "Raleway", family: "'Raleway Variable', system-ui, sans-serif", google: "Raleway" },
    { id: "dm-sans", label: "DM Sans", family: "'DM Sans Variable', system-ui, sans-serif", google: "DM Sans" },
    { id: "public-sans", label: "Public Sans", family: "'Public Sans Variable', system-ui, sans-serif", google: "Public Sans" },
    { id: "outfit", label: "Outfit", family: "'Outfit Variable', system-ui, sans-serif", google: "Outfit" },
    { id: "oxanium", label: "Oxanium", family: "'Oxanium Variable', system-ui, sans-serif", google: "Oxanium" },
    { id: "manrope", label: "Manrope", family: "'Manrope Variable', system-ui, sans-serif", google: "Manrope" },
    { id: "space-grotesk", label: "Space Grotesk", family: "'Space Grotesk Variable', system-ui, sans-serif", google: "Space Grotesk" },
    { id: "montserrat", label: "Montserrat", family: "'Montserrat Variable', system-ui, sans-serif", google: "Montserrat" },
    { id: "ibm-plex-sans", label: "IBM Plex Sans", family: "'IBM Plex Sans Variable', system-ui, sans-serif", google: "IBM Plex Sans" },
    { id: "source-sans-3", label: "Source Sans 3", family: "'Source Sans 3 Variable', system-ui, sans-serif", google: "Source Sans 3" },
    { id: "instrument-sans", label: "Instrument Sans", family: "'Instrument Sans Variable', system-ui, sans-serif", google: "Instrument Sans" },
    { id: "jetbrains-mono", label: "JetBrains Mono", family: "'JetBrains Mono Variable', ui-monospace, monospace", google: "JetBrains Mono" },
    { id: "geist-mono", label: "Geist Mono", family: "'Geist Mono Variable', ui-monospace, monospace", google: "Geist Mono" },
    { id: "noto-serif", label: "Noto Serif", family: "'Noto Serif Variable', Georgia, serif", google: "Noto Serif" },
    { id: "roboto-slab", label: "Roboto Slab", family: "'Roboto Slab Variable', Georgia, serif", google: "Roboto Slab" },
    { id: "merriweather", label: "Merriweather", family: "'Merriweather Variable', Georgia, serif", google: "Merriweather" },
    { id: "lora", label: "Lora", family: "'Lora Variable', Georgia, serif", google: "Lora" },
    { id: "playfair-display", label: "Playfair Display", family: "'Playfair Display Variable', Georgia, serif", google: "Playfair Display" },
    { id: "eb-garamond", label: "EB Garamond", family: "'EB Garamond Variable', Georgia, serif", google: "EB Garamond" },
    { id: "instrument-serif", label: "Instrument Serif", family: "'Instrument Serif', Georgia, serif", google: "Instrument Serif" },
  ];

  var COLOR_KEYS = [
    "background",
    "foreground",
    "card",
    "card-foreground",
    "popover",
    "popover-foreground",
    "primary",
    "primary-foreground",
    "secondary",
    "secondary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "accent-foreground",
    "destructive",
    "destructive-foreground",
    "border",
    "input",
    "ring",
    "chart-1",
    "chart-2",
    "chart-3",
    "chart-4",
    "chart-5",
    "sidebar",
    "sidebar-foreground",
    "sidebar-primary",
    "sidebar-primary-foreground",
    "sidebar-accent",
    "sidebar-accent-foreground",
    "sidebar-border",
    "sidebar-ring",
  ];

  var FONT_KEYS = ["font-sans", "font-serif", "font-mono", "font-heading"];

  var PRESET_FIELDS_V1 = [
    { key: "menuColor", values: ["default", "inverted", "default-translucent", "inverted-translucent"], bits: 3 },
    { key: "menuAccent", values: ["subtle", "bold"], bits: 3 },
    { key: "radius", values: ["default", "none", "small", "medium", "large"], bits: 4 },
    { key: "font", values: PRESET_FONTS, bits: 6 },
    { key: "iconLibrary", values: ["lucide", "hugeicons", "tabler", "phosphor", "remixicon"], bits: 6 },
    { key: "theme", values: PRESET_THEMES, bits: 6 },
    { key: "baseColor", values: BASE_COLOR_NAMES, bits: 6 },
    { key: "style", values: PRESET_STYLES, bits: 6 },
  ];

  var PRESET_FIELDS_V2 = PRESET_FIELDS_V1.concat([
    { key: "chartColor", values: PRESET_THEMES, bits: 6 },
    { key: "fontHeading", values: PRESET_FONT_HEADINGS, bits: 5 },
  ]);

  var DEFAULT_CONFIG = {
    style: "vega",
    baseColor: "neutral",
    theme: "neutral",
    chartColor: "neutral",
    font: "inter",
    fontHeading: "inherit",
    radius: "default",
    menuAccent: "subtle",
    menuColor: "default",
  };

  var THEME_NAMES = Object.keys(THEMES || {});

  function normalizeColorName(name) {
    if (!name) return "neutral";
    if (name === "gray") return "zinc";
    if (THEMES[name]) return name;
    return "neutral";
  }

  function normalizeBaseColor(name) {
    return normalizeColorName(name);
  }

  function getThemesForBaseColor(baseColor) {
    var normalized = normalizeBaseColor(baseColor);
    var bases = BASE_COLOR_NAMES.map(normalizeColorName);
    var out = [];
    for (var i = 0; i < PRESET_THEMES.length; i++) {
      var name = normalizeColorName(PRESET_THEMES[i]);
      if (!THEMES[name]) continue;
      if (name === normalized || bases.indexOf(name) === -1) {
        if (out.indexOf(name) === -1) out.push(name);
      }
    }
    return out;
  }

  var panelOpen = false;
  var themeActive = false;
  var config = cloneConfig(DEFAULT_CONFIG);
  var panelEl = null;
  var openMenu = null;

  function cloneConfig(source) {
    var out = {};
    for (var key in source) out[key] = source[key];
    return out;
  }

  function findFont(id) {
    for (var i = 0; i < FONTS.length; i++) {
      if (FONTS[i].id === id) return FONTS[i];
    }
    var label = id.replace(/-/g, " ").replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
    return {
      id: id,
      label: label,
      family: label + ", system-ui, sans-serif",
      google: label,
    };
  }

  function findLabel(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i].label;
    }
    return id;
  }

  function headingFontFamily() {
    if (config.fontHeading === "inherit" || config.fontHeading === config.font) {
      return findFont(config.font).family;
    }
    return findFont(config.fontHeading).family;
  }

  function buildThemeStyles() {
    var baseColor = normalizeBaseColor(config.baseColor);
    var themeName = normalizeColorName(config.theme);
    var chartName = normalizeColorName(config.chartColor);
    var base = THEMES[baseColor];
    var theme = THEMES[themeName];
    var chart = THEMES[chartName] || theme;
    if (!base || !theme) return null;

    var light = {};
    var dark = {};
    var key;
    for (key in base.light) light[key] = base.light[key];
    for (key in theme.light) light[key] = theme.light[key];
    for (key in base.dark) dark[key] = base.dark[key];
    for (key in theme.dark) dark[key] = theme.dark[key];

    for (var i = 1; i <= 5; i++) {
      var chartKey = "chart-" + i;
      if (chart.light[chartKey]) light[chartKey] = chart.light[chartKey];
      if (chart.dark[chartKey]) dark[chartKey] = chart.dark[chartKey];
    }

    if (config.menuAccent === "bold") {
      light.accent = light.primary;
      light["accent-foreground"] = light["primary-foreground"];
      dark.accent = dark.primary;
      dark["accent-foreground"] = dark["primary-foreground"];
    }

    var radius = RADII.find(function (r) { return r.id === config.radius; });
    if (radius && radius.value) {
      light.radius = radius.value;
      dark.radius = radius.value;
    } else {
      var styleSurface = STYLE_SURFACES[config.style] || STYLE_SURFACES.vega;
      if (styleSurface.radius) {
        light.radius = styleSurface.radius;
        dark.radius = styleSurface.radius;
      }
    }

    var bodyFont = findFont(config.font);
    var headingFamily = headingFontFamily();
    var monoFont = findFont("jetbrains-mono");
    var styleSurface = STYLE_SURFACES[config.style] || STYLE_SURFACES.vega;

    light["font-sans"] = bodyFont.family;
    light["font-heading"] = headingFamily;
    light["font-mono"] = monoFont.family;
    light["font-serif"] = findFont("lora").family;
    light["letter-spacing"] = styleSurface.letterSpacing;
    dark["font-sans"] = bodyFont.family;
    dark["font-heading"] = headingFamily;
    dark["font-mono"] = monoFont.family;
    dark["font-serif"] = findFont("lora").family;
    dark["letter-spacing"] = styleSurface.letterSpacing;

    return { light: light, dark: dark };
  }

  function radiusScale() {
    return "\n  --radius-sm: calc(var(--radius) * 0.6);\n  --radius-md: calc(var(--radius) * 0.8);\n  --radius-lg: var(--radius);\n  --radius-xl: calc(var(--radius) * 1.4);\n  --radius-2xl: calc(var(--radius) * 1.8);\n  --radius-3xl: calc(var(--radius) * 2.2);\n  --radius-4xl: calc(var(--radius) * 2.6);";
  }

  function colorVars(styles) {
    var lines = [];
    for (var i = 0; i < COLOR_KEYS.length; i++) {
      var key = COLOR_KEYS[i];
      var value = styles[key];
      if (!value) continue;
      lines.push("  --" + key + ": " + value + " !important;");
    }
    for (var j = 0; j < TAILWIND_COLOR_KEYS.length; j++) {
      var tk = TAILWIND_COLOR_KEYS[j];
      var tv = styles[tk];
      if (!tv) continue;
      lines.push("  --color-" + tk + ": " + tv + " !important;");
    }
    return lines.join("\n");
  }

  function fontVars(styles) {
    var lines = [];
    for (var i = 0; i < FONT_KEYS.length; i++) {
      var key = FONT_KEYS[i];
      if (styles[key]) lines.push("  --" + key + ": " + styles[key] + " !important;");
    }
    return lines.join("\n");
  }

  function styleOverrideCss(styleId) {
    var sel = 'html[data-ddd-style="' + styleId + '"]';
    var surface = STYLE_SURFACES[styleId] || STYLE_SURFACES.vega;
    var rounded =
      sel +
      " :is(.rounded-sm,.rounded-md,.rounded-lg,.rounded-xl,.rounded-2xl,.rounded-3xl,.rounded-t-xl,.rounded-b-xl,.rounded-t-lg,.rounded-b-lg,.rounded-t-md,.rounded-b-md)";
    var css = "";
    var radiusPick = RADII.find(function (r) {
      return r.id === config.radius;
    });

    css +=
      sel +
      " .group\\/card,[data-slot='card']{gap:" +
      surface.cardGap +
      "!important;padding-top:" +
      surface.cardPy +
      "!important;padding-bottom:" +
      surface.cardPy +
      "!important}";

    if (radiusPick && radiusPick.value === "0") {
      css += rounded + "{border-radius:0!important}";
      css += sel + " button,.group\\/button,[role='button']{border-radius:0!important}";
      return css;
    }

    if (styleId === "lyra") {
      css += rounded + "{border-radius:0!important}";
      css += sel + " .border{border-width:2px!important}";
      css += sel + " button,.group\\/button,[role='button']{border-radius:0!important}";
      css += sel + " .group\\/card,[data-slot='card']{font-size:0.8125rem!important;line-height:1.625!important}";
    } else if (styleId === "maia" || styleId === "luma") {
      css += rounded + "{border-radius:var(--radius-2xl)!important}";
      css += sel + " button,.group\\/button{border-radius:var(--radius-xl)!important}";
    } else if (styleId === "nova" || styleId === "mira" || styleId === "rhea") {
      css += sel + " button,.group\\/button{height:1.75rem!important;min-height:1.75rem!important}";
      css += sel + " .group\\/card-header,[data-slot='card-header']{padding-left:0.75rem!important;padding-right:0.75rem!important}";
    } else if (styleId === "sera") {
      css += sel + " h1," + sel + " h2," + sel + " h3," + sel + " .font-heading{font-weight:500!important;letter-spacing:-0.01em!important}";
    }

    return css;
  }

  function themeBlock(styles, mode) {
    var selector = mode === "dark" ? "html.dark, .dark" : "html, html:root, :root";
    var modeStyles = styles[mode];
    var tracking =
      modeStyles["letter-spacing"] && modeStyles["letter-spacing"] !== "0em"
        ? "\n  letter-spacing: " + modeStyles["letter-spacing"] + ";"
        : "";
    return (
      selector +
      " {\n" +
      colorVars(modeStyles) +
      "\n" +
      fontVars(modeStyles) +
      "\n  --radius: " +
      (modeStyles.radius || "0.625rem") +
      " !important;" +
      radiusScale() +
      tracking +
      "\n}"
    );
  }

  function generateThemeCss(styles) {
    var css = themeBlock(styles, "light") + "\n\n" + themeBlock(styles, "dark");
    css +=
      "\n\nhtml body{font-family:var(--font-sans, system-ui, sans-serif)!important;}" +
      "html h1,html h2,html h3,html h4,html h5,html h6,html .font-heading{font-family:var(--font-heading, var(--font-sans, system-ui, sans-serif))!important;}";
    css += "\n" + styleOverrideCss(config.style);
    return css;
  }

  function collectGoogleFonts(styles) {
    var seen = Object.create(null);
    var families = [];
    var ids = [config.font];
    if (config.fontHeading !== "inherit" && config.fontHeading !== config.font) {
      ids.push(config.fontHeading);
    }
    for (var i = 0; i < ids.length; i++) {
      var font = findFont(ids[i]);
      if (!font || !font.google || seen[font.google]) continue;
      seen[font.google] = true;
      families.push(font.google);
    }
    return families;
  }

  function buildGoogleFontsUrl(families) {
    return (
      "https://fonts.googleapis.com/css2?" +
      families
        .map(function (name) {
          return "family=" + name.replace(/\s+/g, "+") + ":wght@400;500;600;700";
        })
        .join("&") +
      "&display=swap"
    );
  }

  function applyGoogleFonts(styles) {
    var families = collectGoogleFonts(styles);
    var link = document.getElementById(FONT_LINK_ID);
    if (!families.length) {
      if (link) link.remove();
      return;
    }
    var href = buildGoogleFontsUrl(families);
    if (!link) {
      link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }

  function removeGoogleFonts() {
    var link = document.getElementById(FONT_LINK_ID);
    if (link) link.remove();
  }

  function applyThemeCss(css) {
    if (!css) {
      var el = document.getElementById(STYLE_ID);
      if (el) el.remove();
      return;
    }
    var styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
    }
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function saveThemeState() {
    try {
      if (themeActive) {
        sessionStorage.setItem("ddd-shadcn-config", JSON.stringify(config));
      } else {
        sessionStorage.removeItem("ddd-shadcn-config");
      }
    } catch (_) {}
  }

  function applyTheme() {
    if (!themeActive) return;
    var styles = buildThemeStyles();
    if (!styles) return;
    document.documentElement.setAttribute("data-ddd-style", config.style);
    applyThemeCss(generateThemeCss(styles));
    applyGoogleFonts(styles);
    renderPanel();
  }

  function setConfig(partial) {
    var next = cloneConfig(config);
    var key;
    for (key in partial) next[key] = partial[key];

    var available = getThemesForBaseColor(next.baseColor);
    if (available.indexOf(next.theme) === -1) next.theme = next.baseColor;
    if (available.indexOf(next.chartColor) === -1) next.chartColor = next.theme;

    config = next;
    themeActive = true;
    saveThemeState();
    applyTheme();
  }

  function resetTheme() {
    themeActive = false;
    config = cloneConfig(DEFAULT_CONFIG);
    openMenu = null;
    try {
      sessionStorage.removeItem("ddd-shadcn-config");
      sessionStorage.removeItem("ddd-shadcn-palette");
      sessionStorage.removeItem("ddd-shadcn-variant");
      sessionStorage.removeItem("ddd-shadcn-preset");
    } catch (_) {}
    document.documentElement.removeAttribute("data-ddd-style");
    applyThemeCss(null);
    removeGoogleFonts();
    renderPanel();
  }

  function toBase62(num) {
    if (num === 0) return "0";
    var result = "";
    var n = num;
    while (n > 0) {
      result = BASE62[n % 62] + result;
      n = Math.floor(n / 62);
    }
    return result;
  }

  function fromBase62(str) {
    var result = 0;
    for (var i = 0; i < str.length; i++) {
      var idx = BASE62.indexOf(str[i]);
      if (idx === -1) return -1;
      result = result * 62 + idx;
    }
    return result;
  }

  function encodePreset(cfg) {
    var merged = {
      menuColor: "default",
      menuAccent: "subtle",
      radius: "default",
      font: "inter",
      iconLibrary: "lucide",
      theme: "neutral",
      baseColor: "neutral",
      style: "vega",
      chartColor: "neutral",
      fontHeading: "inherit",
    };
    var key;
    for (key in cfg) {
      if (cfg[key] != null) merged[key] = cfg[key];
    }
    if (!merged.chartColor) merged.chartColor = merged.theme;

    var bits = 0;
    var offset = 0;
    for (var i = 0; i < PRESET_FIELDS_V2.length; i++) {
      var field = PRESET_FIELDS_V2[i];
      var idx = field.values.indexOf(merged[field.key]);
      bits += (idx === -1 ? 0 : idx) * Math.pow(2, offset);
      offset += field.bits;
    }
    return "b" + toBase62(bits);
  }

  function decodePreset(code) {
    if (!code || code.length < 2) return null;
    var version = code[0];
    if (version !== "a" && version !== "b") return null;

    var fields = version === "a" ? PRESET_FIELDS_V1 : PRESET_FIELDS_V2;
    var bits = fromBase62(code.slice(1));
    if (bits < 0) return null;

    var result = {
      menuColor: "default",
      menuAccent: "subtle",
      radius: "default",
      font: "inter",
      iconLibrary: "lucide",
      theme: "neutral",
      baseColor: "neutral",
      style: "vega",
      chartColor: "neutral",
      fontHeading: "inherit",
    };
    var offset = 0;
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var idx = Math.floor(bits / Math.pow(2, offset)) % Math.pow(2, field.bits);
      result[field.key] = field.values[idx] || field.values[0];
      offset += field.bits;
    }

    if (version === "a") {
      result.fontHeading = "inherit";
      result.chartColor =
        V1_CHART_COLOR_MAP[result.baseColor] || result.theme;
    }

    return result;
  }

  function applyPresetDecoded(decoded) {
    if (!decoded) return false;

    var baseColor = normalizeBaseColor(decoded.baseColor);
    var theme = normalizeColorName(decoded.theme);
    var chartColor = normalizeColorName(decoded.chartColor || decoded.theme);
    var available = getThemesForBaseColor(baseColor);

    if (available.indexOf(theme) === -1) theme = baseColor;
    if (available.indexOf(chartColor) === -1) chartColor = theme;

    var font = PRESET_FONTS.indexOf(decoded.font) !== -1 ? decoded.font : "inter";
    var fontHeading =
      PRESET_FONT_HEADINGS.indexOf(decoded.fontHeading) !== -1
        ? decoded.fontHeading
        : "inherit";
    var style =
      PRESET_STYLES.indexOf(decoded.style) !== -1 ? decoded.style : "vega";
    var radius =
      ["default", "none", "small", "medium", "large"].indexOf(decoded.radius) !== -1
        ? decoded.radius
        : "default";

    config = cloneConfig({
      style: style,
      baseColor: baseColor,
      theme: theme,
      chartColor: chartColor,
      font: font,
      fontHeading: fontHeading,
      radius: radius,
      menuAccent: decoded.menuAccent || "subtle",
      menuColor: decoded.menuColor || "default",
    });
    themeActive = true;
    saveThemeState();
    applyTheme();
    return true;
  }

  function currentPresetCode() {
    return encodePreset(config);
  }

  function shuffleTheme() {
    function pick(list) {
      return list[Math.floor(Math.random() * list.length)];
    }
    var baseColor = pick(BASE_COLOR_NAMES);
    var available = getThemesForBaseColor(baseColor);
    setConfig({
      style: pick(STYLES).id,
      baseColor: baseColor,
      theme: pick(available),
      chartColor: pick(available),
      font: pick(FONTS).id,
      fontHeading: Math.random() > 0.7 ? pick(FONTS).id : "inherit",
      radius: pick(RADII).id,
    });
  }

  function themeCssText() {
    var styles = buildThemeStyles();
    if (!styles) return "";
    return generateThemeCss(styles);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  function swatchColor(themeName) {
    var theme = THEMES[themeName];
    if (!theme || !theme.light) return "#a1a1aa";
    var c = theme.light.primary || theme.light["chart-1"] || theme.light.background;
    if (!c) return "#a1a1aa";
    if (c.indexOf("oklch(") === 0) return c;
    return c;
  }

  function styleIcon(id) {
    if (id === "nova") {
      return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" fill="none" stroke-width="1.25"/></svg>';
    }
    if (id === "maia") {
      return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="4" stroke="currentColor" fill="none" stroke-width="1.25"/></svg>';
    }
    if (id === "lyra") {
      return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="0" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
    }
    if (id === "mira" || id === "rhea") {
      return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="4" width="10" height="2" fill="currentColor"/><rect x="3" y="7" width="10" height="2" fill="currentColor"/><rect x="3" y="10" width="10" height="2" fill="currentColor"/></svg>';
    }
    if (id === "luma" || id === "sera") {
      return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" stroke="currentColor" fill="none" stroke-width="1.25"/></svg>';
    }
    return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" fill="none" stroke-width="1.25"/></svg>';
  }

  function fontIcon() {
    return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><text x="1" y="13" font-size="12" font-family="Georgia, serif" fill="currentColor">Aa</text></svg>';
  }

  function radiusIcon() {
    return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13V8a5 5 0 0 1 5-5h5" stroke="currentColor" fill="none" stroke-width="1.25" stroke-linecap="round"/></svg>';
  }

  function colorDot(color) {
    return (
      '<span class="dot" style="background:' +
      swatchColor(color) +
      '"></span>'
    );
  }

  function ShadcnPanel() {
    return Reflect.construct(HTMLElement, [], ShadcnPanel);
  }

  ShadcnPanel.prototype = Object.create(HTMLElement.prototype);
  ShadcnPanel.prototype.constructor = ShadcnPanel;

  ShadcnPanel.prototype.connectedCallback = function () {
    if (this._ready) return;
    this._ready = true;

    var shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML =
      "<style>" +
      ":host{position:fixed;top:16px;right:16px;width:min(272px,calc(100vw - 32px));max-height:calc(100vh - 32px);z-index:2147483646;pointer-events:none;font-family:Inter,system-ui,-apple-system,sans-serif}" +
      ":host([open]){pointer-events:auto}" +
      ".panel{position:relative;width:100%;max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:rgba(24,24,27,.96);color:#fafafa;border:1px solid rgba(255,255,255,.08);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.35);transform:translateX(calc(100% + 24px));transition:transform .25s ease;overflow:hidden}" +
      ":host([open]) .panel{transform:translateX(0)}" +
      ".head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 6px;border-bottom:1px solid rgba(255,255,255,.06)}" +
      ".head-title{font-size:12px;font-weight:600;margin:0;color:#fafafa}" +
      ".icon-btn{width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:#a1a1aa;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px}" +
      ".icon-btn:hover{background:rgba(255,255,255,.06);color:#fafafa}" +
      ".rows{overflow:auto;padding:6px;display:flex;flex-direction:column;gap:3px;max-height:min(52vh,360px)}" +
      ".row{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:1px solid rgba(255,255,255,.06);border-radius:8px;background:rgba(255,255,255,.03);color:#fafafa;cursor:pointer;text-align:left;font-size:12px;line-height:1.2}" +
      ".row:hover{background:rgba(255,255,255,.06)}" +
      ".row-label{flex:1;color:#a1a1aa;font-size:11px}" +
      ".row-value{display:flex;align-items:center;gap:6px;font-weight:500;color:#fafafa;font-size:12px}" +
      ".row-icon{color:#d4d4d8;display:flex;align-items:center;justify-content:center;width:14px;height:14px;flex-shrink:0}" +
      ".dot{width:12px;height:12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);flex-shrink:0}" +
      ".foot{padding:6px 8px 8px;border-top:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:6px}" +
      ".preset-row{display:flex;gap:4px}" +
      ".preset-code{flex:1;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.25);color:#e4e4e7;font-size:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".btn{padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#fafafa;font-size:11px;font-weight:500;cursor:pointer}" +
      ".btn:hover{background:rgba(255,255,255,.08)}" +
      ".btn-primary{background:#fafafa;color:#18181b;border-color:#fafafa}" +
      ".btn-primary:hover{background:#e4e4e7}" +
      ".actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}" +
      ".menu{position:absolute;z-index:2;min-width:220px;max-height:280px;overflow:auto;padding:6px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(24,24,27,.98);box-shadow:0 16px 48px rgba(0,0,0,.45)}" +
      ".menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:#fafafa;font-size:13px;text-align:left;cursor:pointer}" +
      ".menu-item:hover{background:rgba(255,255,255,.06)}" +
      ".menu-item[data-active]{background:rgba(255,255,255,.1)}" +
      ".menu-check{margin-left:auto;color:#a1a1aa;font-size:12px}" +
      ".menu-group{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#71717a;padding:8px 10px 4px}" +
      ".wrap{position:relative}" +
      "</style>" +
      '<div class="panel" part="panel">' +
      '<header class="head"><h2 class="head-title">Menu</h2><button type="button" class="icon-btn reset" aria-label="Reset theme">↺</button></header>' +
      '<div class="rows" part="rows"></div>' +
      '<div class="foot" part="foot">' +
      '<div class="preset-row"><div class="preset-code" part="preset"></div></div>' +
      '<div class="actions">' +
      '<button type="button" class="btn open-preset">Open Preset</button>' +
      '<button type="button" class="btn shuffle">Shuffle</button>' +
      '</div>' +
      '<button type="button" class="btn btn-primary get-code">Get Code</button>' +
      "</div>" +
      "</div>";

    var self = this;
    shadow.querySelector(".reset").addEventListener("click", function () {
      if (self._onReset) self._onReset();
    });
    shadow.querySelector(".open-preset").addEventListener("click", function () {
      var input = window.prompt("Paste preset code", "");
      if (!input) return;
      var code = input.replace(/^--preset\s*/i, "").trim();
      var decoded = decodePreset(code);
      if (!decoded || !applyPresetDecoded(decoded)) {
        window.alert("Invalid preset code");
      }
    });
    shadow.querySelector(".shuffle").addEventListener("click", shuffleTheme);
    shadow.querySelector(".get-code").addEventListener("click", function () {
      copyText(themeCssText()).then(function () {
        var btn = shadow.querySelector(".get-code");
        if (!btn) return;
        var prev = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(function () {
          btn.textContent = prev;
        }, 1200);
      });
    });
  };

  ShadcnPanel.prototype.open = function () {
    this.setAttribute("open", "");
  };

  ShadcnPanel.prototype.close = function () {
    this.removeAttribute("open");
    openMenu = null;
    this.render();
  };

  ShadcnPanel.prototype.toggle = function () {
    if (this.hasAttribute("open")) this.close();
    else this.open();
  };

  ShadcnPanel.prototype.bind = function (opts) {
    this._onClose = opts.onClose;
    this._onReset = opts.onReset;
  };

  ShadcnPanel.prototype.closeMenus = function () {
    openMenu = null;
    var menus = this.shadowRoot && this.shadowRoot.querySelectorAll(".menu");
    if (menus) {
      for (var i = 0; i < menus.length; i++) menus[i].remove();
    }
  };

  ShadcnPanel.prototype.openMenuFor = function (anchor, menuId, items, onPick) {
    var self = this;
    this.closeMenus();
    openMenu = menuId;

    var menu = document.createElement("div");
    menu.className = "menu";
    menu.setAttribute("data-menu", menuId);

    items.forEach(function (item) {
      if (item.type === "group") {
        var group = document.createElement("div");
        group.className = "menu-group";
        group.textContent = item.label;
        menu.appendChild(group);
        return;
      }
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-item";
      if (item.active) btn.setAttribute("data-active", "true");
      if (item.dot) {
        var dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = item.dot;
        btn.appendChild(dot);
      }
      var label = document.createElement("span");
      label.textContent = item.label;
      btn.appendChild(label);
      if (item.active) {
        var check = document.createElement("span");
        check.className = "menu-check";
        check.textContent = "✓";
        btn.appendChild(check);
      }
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        onPick(item.id);
        self.closeMenus();
      });
      menu.appendChild(btn);
    });

    var panel = this.shadowRoot.querySelector(".panel");
    panel.appendChild(menu);

    var rect = anchor.getBoundingClientRect();
    var panelRect = panel.getBoundingClientRect();
    menu.style.left = Math.max(8, rect.left - panelRect.left) + "px";
    menu.style.top = rect.bottom - panelRect.top + 6 + "px";
    menu.style.width = Math.max(rect.width, 220) + "px";
  };

  ShadcnPanel.prototype.render = function () {
    var root = this.shadowRoot;
    if (!root) return;
    var rows = root.querySelector(".rows");
    var preset = root.querySelector(".preset-code");
    if (!rows || !preset) return;

    rows.innerHTML = "";
    preset.textContent = "--preset " + currentPresetCode();
    preset.style.cursor = "pointer";
    preset.title = "Click to copy preset";
    preset.onclick = function () {
      copyText(preset.textContent || "");
    };

    var self = this;
    var availableThemes = getThemesForBaseColor(config.baseColor);

    function addRow(opts) {
      var wrap = document.createElement("div");
      wrap.className = "wrap";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "row";
      btn.innerHTML =
        '<span class="row-label">' +
        opts.label +
        '</span><span class="row-value">' +
        (opts.dot || "") +
        "<span>" +
        opts.value +
        '</span></span><span class="row-icon">' +
        opts.icon +
        "</span>";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        opts.onOpen(btn);
      });
      wrap.appendChild(btn);
      rows.appendChild(wrap);
    }

    addRow({
      label: "Style",
      value: findLabel(STYLES, config.style),
      icon: styleIcon(config.style),
      onOpen: function (anchor) {
        self.openMenuFor(
          anchor,
          "style",
          STYLES.map(function (s) {
            return { id: s.id, label: s.label, active: s.id === config.style };
          }),
          function (id) {
            setConfig({ style: id });
          }
        );
      },
    });

    addRow({
      label: "Base Color",
      value: findLabel(
        BASE_COLOR_NAMES.map(function (n) {
          return { id: n, label: THEMES[n] ? THEMES[n].label : n };
        }),
        config.baseColor
      ),
      dot: colorDot(config.baseColor),
      icon: styleIcon("vega"),
      onOpen: function (anchor) {
        self.openMenuFor(
          anchor,
          "baseColor",
          BASE_COLOR_NAMES.map(function (name) {
            return {
              id: name,
              label: THEMES[name] ? THEMES[name].label : name,
              dot: swatchColor(name),
              active: name === config.baseColor,
            };
          }),
          function (id) {
            setConfig({ baseColor: id });
          }
        );
      },
    });

    addRow({
      label: "Theme",
      value: THEMES[config.theme] ? THEMES[config.theme].label : config.theme,
      dot: colorDot(config.theme),
      icon: styleIcon("vega"),
      onOpen: function (anchor) {
        self.openMenuFor(
          anchor,
          "theme",
          availableThemes.map(function (name) {
            return {
              id: name,
              label: THEMES[name] ? THEMES[name].label : name,
              dot: swatchColor(name),
              active: name === config.theme,
            };
          }),
          function (id) {
            setConfig({ theme: id });
          }
        );
      },
    });

    addRow({
      label: "Chart Color",
      value: THEMES[config.chartColor]
        ? THEMES[config.chartColor].label
        : config.chartColor,
      dot: colorDot(config.chartColor),
      icon: styleIcon("vega"),
      onOpen: function (anchor) {
        self.openMenuFor(
          anchor,
          "chartColor",
          availableThemes.map(function (name) {
            return {
              id: name,
              label: THEMES[name] ? THEMES[name].label : name,
              dot: swatchColor(name),
              active: name === config.chartColor,
            };
          }),
          function (id) {
            setConfig({ chartColor: id });
          }
        );
      },
    });

    var headingLabel =
      config.fontHeading === "inherit"
        ? findFont(config.font).label
        : findFont(config.fontHeading).label;

    addRow({
      label: "Heading",
      value: headingLabel,
      icon: fontIcon(),
      onOpen: function (anchor) {
        var items = [{ id: "inherit", label: "Inherit", active: config.fontHeading === "inherit" }];
        FONTS.forEach(function (font) {
          items.push({
            id: font.id,
            label: font.label,
            active: config.fontHeading === font.id,
          });
        });
        self.openMenuFor(anchor, "fontHeading", items, function (id) {
          setConfig({ fontHeading: id });
        });
      },
    });

    addRow({
      label: "Font",
      value: findFont(config.font).label,
      icon: fontIcon(),
      onOpen: function (anchor) {
        self.openMenuFor(
          anchor,
          "font",
          [{ type: "group", label: "Sans" }].concat(
            FONTS.filter(function (f) {
              return f.id !== "jetbrains-mono" && f.id !== "geist-mono";
            }).map(function (font) {
              return {
                id: font.id,
                label: font.label,
                active: config.font === font.id,
              };
            })
          ),
          function (id) {
            setConfig({ font: id });
          }
        );
      },
    });

    addRow({
      label: "Radius",
      value: findLabel(RADII, config.radius),
      icon: radiusIcon(),
      onOpen: function (anchor) {
        self.openMenuFor(
          anchor,
          "radius",
          RADII.map(function (r) {
            return { id: r.id, label: r.label, active: r.id === config.radius };
          }),
          function (id) {
            setConfig({ radius: id });
          }
        );
      },
    });
  };

  if (!customElements.get(PANEL_TAG)) {
    customElements.define(PANEL_TAG, ShadcnPanel);
  }

  function renderPanel() {
    if (!panelEl) return;
    panelEl.render();
  }

  function ensurePanel() {
    if (panelEl) return panelEl;
    panelEl = document.createElement(PANEL_TAG);
    panelEl.bind({
      onClose: function () {
        panelOpen = false;
      },
      onReset: resetTheme,
    });
    document.body.appendChild(panelEl);
    renderPanel();
    return panelEl;
  }

  function openPanel() {
    ensurePanel();
    panelOpen = true;
    renderPanel();
    requestAnimationFrame(function () {
      if (panelEl) panelEl.open();
    });
  }

  function closePanel() {
    panelOpen = false;
    openMenu = null;
    if (!panelEl) return;
    panelEl.remove();
    panelEl = null;
  }

  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && panelOpen) {
      event.preventDefault();
      closePanel();
    }
  }

  document.addEventListener("click", function (e) {
    if (!panelEl || !openMenu) return;
    var path = e.composedPath ? e.composedPath() : [];
    if (path.indexOf(panelEl) !== -1) return;
    panelEl.closeMenus();
  });

  window.addEventListener("keydown", onKeyDown);

  try {
    var saved = sessionStorage.getItem("ddd-shadcn-config");
    if (saved) {
      config = JSON.parse(saved);
      themeActive = true;
      applyTheme();
    }
  } catch (_) {}

  dddx.action.onClicked(function () {
    togglePanel();
  });

  dddx.extension.onDispose(function () {
    window.removeEventListener("keydown", onKeyDown);
    closePanel();
    if (panelEl) panelEl.remove();
    panelEl = null;
    applyThemeCss(null);
    removeGoogleFonts();
  });
})();
