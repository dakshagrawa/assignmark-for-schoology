(() => {
  // node_modules/@melloware/coloris/dist/esm/coloris.js
  var Coloris = (() => {
    return ((window2, document2, Math2, undefined2) => {
      const ctx = document2.createElement("canvas").getContext("2d");
      const currentColor = { r: 0, g: 0, b: 0, h: 0, s: 0, v: 0, a: 1 };
      let container, picker, colorArea, colorMarker, colorPreview, colorValue, clearButton, closeButton, hueSlider, hueMarker, alphaSlider, alphaMarker, currentEl, currentFormat, oldColor, keyboardNav, colorAreaDims = {};
      const settings = {
        el: "[data-coloris]",
        parent: "body",
        theme: "default",
        themeMode: "light",
        rtl: false,
        wrap: true,
        margin: 2,
        format: "hex",
        formatToggle: false,
        swatches: [],
        swatchesOnly: false,
        alpha: true,
        forceAlpha: false,
        focusInput: true,
        selectInput: false,
        inline: false,
        defaultColor: "#000000",
        clearButton: false,
        clearLabel: "Clear",
        closeButton: false,
        closeLabel: "Close",
        onChange: () => undefined2,
        a11y: {
          open: "Open color picker",
          close: "Close color picker",
          clear: "Clear the selected color",
          marker: "Saturation: {s}. Brightness: {v}.",
          hueSlider: "Hue slider",
          alphaSlider: "Opacity slider",
          input: "Color value field",
          format: "Color format",
          swatch: "Color swatch",
          instruction: "Saturation and brightness selector. Use up, down, left and right arrow keys to select."
        }
      };
      const instances = {};
      let currentInstanceId = "";
      let defaultInstance = {};
      let hasInstance = false;
      function configure(options) {
        if (typeof options !== "object") {
          return;
        }
        for (const key in options) {
          switch (key) {
            case "el":
              bindFields(options.el);
              if (options.wrap !== false) {
                wrapFields(options.el);
              }
              break;
            case "parent":
              container = options.parent instanceof HTMLElement ? options.parent : document2.querySelector(options.parent);
              if (container) {
                container.appendChild(picker);
                settings.parent = options.parent;
                if (container === document2.body) {
                  container = undefined2;
                }
              }
              break;
            case "themeMode":
              settings.themeMode = options.themeMode;
              if (options.themeMode === "auto" && window2.matchMedia && window2.matchMedia("(prefers-color-scheme: dark)").matches) {
                settings.themeMode = "dark";
              }
            // The lack of a break statement is intentional
            case "theme":
              if (options.theme) {
                settings.theme = options.theme;
              }
              picker.className = `clr-picker clr-${settings.theme} clr-${settings.themeMode}`;
              if (settings.inline) {
                updatePickerPosition();
              }
              break;
            case "rtl":
              settings.rtl = !!options.rtl;
              Array.from(document2.getElementsByClassName("clr-field")).forEach((field) => field.classList.toggle("clr-rtl", settings.rtl));
              break;
            case "margin":
              options.margin *= 1;
              settings.margin = !isNaN(options.margin) ? options.margin : settings.margin;
              break;
            case "wrap":
              if (options.el && options.wrap) {
                wrapFields(options.el);
              }
              break;
            case "formatToggle":
              settings.formatToggle = !!options.formatToggle;
              getEl("clr-format").style.display = settings.formatToggle ? "block" : "none";
              if (settings.formatToggle) {
                settings.format = "auto";
              }
              break;
            case "swatches":
              if (Array.isArray(options.swatches)) {
                const swatchesContainer = getEl("clr-swatches");
                const swatches = document2.createElement("div");
                swatchesContainer.textContent = "";
                options.swatches.forEach((swatch, i) => {
                  const button = document2.createElement("button");
                  button.setAttribute("type", `button`);
                  button.setAttribute("id", `clr-swatch-${i}`);
                  button.setAttribute("aria-labelledby", `clr-swatch-label clr-swatch-${i}`);
                  button.style.color = swatch;
                  button.textContent = swatch;
                  swatches.appendChild(button);
                });
                if (options.swatches.length) {
                  swatchesContainer.appendChild(swatches);
                }
                settings.swatches = options.swatches.slice();
              }
              break;
            case "swatchesOnly":
              settings.swatchesOnly = !!options.swatchesOnly;
              picker.setAttribute("data-minimal", settings.swatchesOnly);
              break;
            case "alpha":
              settings.alpha = !!options.alpha;
              picker.setAttribute("data-alpha", settings.alpha);
              break;
            case "inline":
              settings.inline = !!options.inline;
              picker.setAttribute("data-inline", settings.inline);
              if (settings.inline) {
                const defaultColor = options.defaultColor || settings.defaultColor;
                currentFormat = getColorFormatFromStr(defaultColor);
                updatePickerPosition();
                setColorFromStr(defaultColor);
              }
              break;
            case "clearButton":
              if (typeof options.clearButton === "object") {
                if (options.clearButton.label) {
                  settings.clearLabel = options.clearButton.label;
                  clearButton.innerHTML = settings.clearLabel;
                }
                options.clearButton = options.clearButton.show;
              }
              settings.clearButton = !!options.clearButton;
              clearButton.style.display = settings.clearButton ? "block" : "none";
              break;
            case "clearLabel":
              settings.clearLabel = options.clearLabel;
              clearButton.innerHTML = settings.clearLabel;
              break;
            case "closeButton":
              settings.closeButton = !!options.closeButton;
              if (settings.closeButton) {
                picker.insertBefore(closeButton, colorPreview);
              } else {
                colorPreview.appendChild(closeButton);
              }
              break;
            case "closeLabel":
              settings.closeLabel = options.closeLabel;
              closeButton.innerHTML = settings.closeLabel;
              break;
            case "a11y":
              const labels = options.a11y;
              let update = false;
              if (typeof labels === "object") {
                for (const label in labels) {
                  if (labels[label] && settings.a11y[label]) {
                    settings.a11y[label] = labels[label];
                    update = true;
                  }
                }
              }
              if (update) {
                const openLabel = getEl("clr-open-label");
                const swatchLabel = getEl("clr-swatch-label");
                openLabel.innerHTML = settings.a11y.open;
                swatchLabel.innerHTML = settings.a11y.swatch;
                closeButton.setAttribute("aria-label", settings.a11y.close);
                clearButton.setAttribute("aria-label", settings.a11y.clear);
                hueSlider.setAttribute("aria-label", settings.a11y.hueSlider);
                alphaSlider.setAttribute("aria-label", settings.a11y.alphaSlider);
                colorValue.setAttribute("aria-label", settings.a11y.input);
                colorArea.setAttribute("aria-label", settings.a11y.instruction);
              }
              break;
            default:
              settings[key] = options[key];
          }
        }
      }
      function setVirtualInstance(selector, options) {
        if (typeof selector === "string" && typeof options === "object") {
          instances[selector] = options;
          hasInstance = true;
        }
      }
      function removeVirtualInstance(selector) {
        delete instances[selector];
        if (Object.keys(instances).length === 0) {
          hasInstance = false;
          if (selector === currentInstanceId) {
            resetVirtualInstance();
          }
        }
      }
      function attachVirtualInstance(element) {
        if (hasInstance) {
          const unsupportedOptions = ["el", "wrap", "rtl", "inline", "defaultColor", "a11y"];
          for (let selector in instances) {
            const options = instances[selector];
            if (element.matches(selector)) {
              currentInstanceId = selector;
              defaultInstance = {};
              unsupportedOptions.forEach((option) => delete options[option]);
              for (let option in options) {
                defaultInstance[option] = Array.isArray(settings[option]) ? settings[option].slice() : settings[option];
              }
              configure(options);
              break;
            }
          }
        }
      }
      function resetVirtualInstance() {
        if (Object.keys(defaultInstance).length > 0) {
          configure(defaultInstance);
          currentInstanceId = "";
          defaultInstance = {};
        }
      }
      function bindFields(selector) {
        if (selector instanceof HTMLElement) {
          selector = [selector];
        }
        if (Array.isArray(selector)) {
          selector.forEach((field) => {
            addListener(field, "click", openPicker);
            addListener(field, "input", updateColorPreview);
          });
        } else {
          addListener(document2, "click", selector, openPicker);
          addListener(document2, "input", selector, updateColorPreview);
        }
      }
      function openPicker(event) {
        if (settings.inline) {
          return;
        }
        attachVirtualInstance(event.target);
        currentEl = event.target;
        oldColor = currentEl.value;
        currentFormat = getColorFormatFromStr(oldColor);
        picker.classList.add("clr-open");
        updatePickerPosition();
        setColorFromStr(oldColor);
        if (settings.focusInput || settings.selectInput) {
          colorValue.focus({ preventScroll: true });
          colorValue.setSelectionRange(currentEl.selectionStart, currentEl.selectionEnd);
        }
        if (settings.selectInput) {
          colorValue.select();
        }
        if (keyboardNav || settings.swatchesOnly) {
          getFocusableElements().shift().focus();
        }
        currentEl.dispatchEvent(new Event("open", { bubbles: false }));
      }
      function updatePickerPosition() {
        if (!picker || !currentEl && !settings.inline) return;
        const parent = container;
        const scrollY = window2.scrollY;
        const pickerWidth = picker.offsetWidth;
        const pickerHeight = picker.offsetHeight;
        const reposition = { left: false, top: false };
        let parentStyle, parentMarginTop, parentBorderTop;
        let offset = { x: 0, y: 0 };
        if (parent) {
          parentStyle = window2.getComputedStyle(parent);
          parentMarginTop = parseFloat(parentStyle.marginTop);
          parentBorderTop = parseFloat(parentStyle.borderTopWidth);
          offset = parent.getBoundingClientRect();
          offset.y += parentBorderTop + scrollY;
        }
        if (!settings.inline) {
          const coords = currentEl.getBoundingClientRect();
          let left = coords.x;
          let top = scrollY + coords.y + coords.height + settings.margin;
          if (parent) {
            left -= offset.x;
            top -= offset.y;
            if (left + pickerWidth > parent.clientWidth) {
              left += coords.width - pickerWidth;
              reposition.left = true;
            }
            if (top + pickerHeight > parent.clientHeight - parentMarginTop) {
              if (pickerHeight + settings.margin <= coords.top - (offset.y - scrollY)) {
                top -= coords.height + pickerHeight + settings.margin * 2;
                reposition.top = true;
              }
            }
            top += parent.scrollTop;
          } else {
            if (left + pickerWidth > document2.documentElement.clientWidth) {
              left += coords.width - pickerWidth;
              reposition.left = true;
            }
            if (top + pickerHeight - scrollY > document2.documentElement.clientHeight) {
              if (pickerHeight + settings.margin <= coords.top) {
                top = scrollY + coords.y - pickerHeight - settings.margin;
                reposition.top = true;
              }
            }
          }
          picker.classList.toggle("clr-left", reposition.left);
          picker.classList.toggle("clr-top", reposition.top);
          picker.style.left = `${left}px`;
          picker.style.top = `${top}px`;
          offset.x += picker.offsetLeft;
          offset.y += picker.offsetTop;
        }
        colorAreaDims = {
          width: colorArea.offsetWidth,
          height: colorArea.offsetHeight,
          x: colorArea.offsetLeft + offset.x,
          y: colorArea.offsetTop + offset.y
        };
      }
      function wrapFields(selector) {
        if (selector instanceof HTMLElement) {
          wrapColorField(selector);
        } else if (Array.isArray(selector)) {
          selector.forEach(wrapColorField);
        } else {
          document2.querySelectorAll(selector).forEach(wrapColorField);
        }
      }
      function wrapColorField(field) {
        const parentNode = field.parentNode;
        if (!parentNode.classList.contains("clr-field")) {
          const wrapper = document2.createElement("div");
          let classes = "clr-field";
          if (settings.rtl || field.classList.contains("clr-rtl")) {
            classes += " clr-rtl";
          }
          wrapper.innerHTML = '<button type="button" aria-labelledby="clr-open-label"></button>';
          parentNode.insertBefore(wrapper, field);
          wrapper.className = classes;
          wrapper.style.color = field.value;
          wrapper.appendChild(field);
        }
      }
      function updateColorPreview(event) {
        const parent = event.target.parentNode;
        if (parent.classList.contains("clr-field")) {
          parent.style.color = event.target.value;
        }
      }
      function closePicker(revert) {
        if (currentEl && !settings.inline) {
          const prevEl = currentEl;
          if (revert) {
            currentEl = undefined2;
            if (oldColor !== prevEl.value) {
              prevEl.value = oldColor;
              prevEl.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
          setTimeout(() => {
            if (oldColor !== prevEl.value) {
              prevEl.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
          picker.classList.remove("clr-open");
          if (hasInstance) {
            resetVirtualInstance();
          }
          prevEl.dispatchEvent(new Event("close", { bubbles: false }));
          if (settings.focusInput) {
            prevEl.focus({ preventScroll: true });
          }
          currentEl = undefined2;
        }
      }
      function setColorFromStr(str) {
        const rgba = strToRGBA(str);
        const hsva = RGBAtoHSVA(rgba);
        updateMarkerA11yLabel(hsva.s, hsva.v);
        updateColor(rgba, hsva);
        hueSlider.value = hsva.h;
        picker.style.color = `hsl(${hsva.h}, 100%, 50%)`;
        hueMarker.style.left = `${hsva.h / 360 * 100}%`;
        colorMarker.style.left = `${colorAreaDims.width * hsva.s / 100}px`;
        colorMarker.style.top = `${colorAreaDims.height - colorAreaDims.height * hsva.v / 100}px`;
        alphaSlider.value = hsva.a * 100;
        alphaMarker.style.left = `${hsva.a * 100}%`;
      }
      function getColorFormatFromStr(str) {
        const format = str.substring(0, 3).toLowerCase();
        if (format === "rgb" || format === "hsl") {
          return format;
        }
        return "hex";
      }
      function pickColor(color) {
        color = color !== undefined2 ? color : colorValue.value;
        if (currentEl) {
          currentEl.value = color;
          currentEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (settings.onChange) {
          settings.onChange.call(window2, color, currentEl);
        }
        document2.dispatchEvent(new CustomEvent("coloris:pick", { detail: { color, currentEl } }));
      }
      function setColorAtPosition(x, y) {
        const hsva = {
          h: hueSlider.value * 1,
          s: x / colorAreaDims.width * 100,
          v: 100 - y / colorAreaDims.height * 100,
          a: alphaSlider.value / 100
        };
        const rgba = HSVAtoRGBA(hsva);
        updateMarkerA11yLabel(hsva.s, hsva.v);
        updateColor(rgba, hsva);
        pickColor();
      }
      function updateMarkerA11yLabel(saturation, value) {
        let label = settings.a11y.marker;
        saturation = saturation.toFixed(1) * 1;
        value = value.toFixed(1) * 1;
        label = label.replace("{s}", saturation);
        label = label.replace("{v}", value);
        colorMarker.setAttribute("aria-label", label);
      }
      function getPointerPosition(event) {
        return {
          pageX: event.changedTouches ? event.changedTouches[0].pageX : event.pageX,
          pageY: event.changedTouches ? event.changedTouches[0].pageY : event.pageY
        };
      }
      function moveMarker(event) {
        const pointer = getPointerPosition(event);
        let x = pointer.pageX - colorAreaDims.x;
        let y = pointer.pageY - colorAreaDims.y;
        if (container) {
          y += container.scrollTop;
        }
        setMarkerPosition(x, y);
        event.preventDefault();
        event.stopPropagation();
      }
      function moveMarkerOnKeydown(offsetX, offsetY) {
        let x = colorMarker.style.left.replace("px", "") * 1 + offsetX;
        let y = colorMarker.style.top.replace("px", "") * 1 + offsetY;
        setMarkerPosition(x, y);
      }
      function setMarkerPosition(x, y) {
        x = x < 0 ? 0 : x > colorAreaDims.width ? colorAreaDims.width : x;
        y = y < 0 ? 0 : y > colorAreaDims.height ? colorAreaDims.height : y;
        colorMarker.style.left = `${x}px`;
        colorMarker.style.top = `${y}px`;
        setColorAtPosition(x, y);
        colorMarker.focus();
      }
      function updateColor(rgba, hsva) {
        if (rgba === void 0) {
          rgba = {};
        }
        if (hsva === void 0) {
          hsva = {};
        }
        let format = settings.format;
        for (const key in rgba) {
          currentColor[key] = rgba[key];
        }
        for (const key in hsva) {
          currentColor[key] = hsva[key];
        }
        const hex = RGBAToHex(currentColor);
        const opaqueHex = hex.substring(0, 7);
        colorMarker.style.color = opaqueHex;
        alphaMarker.parentNode.style.color = opaqueHex;
        alphaMarker.style.color = hex;
        colorPreview.style.color = hex;
        colorArea.style.display = "none";
        colorArea.offsetHeight;
        colorArea.style.display = "";
        alphaMarker.nextElementSibling.style.display = "none";
        alphaMarker.nextElementSibling.offsetHeight;
        alphaMarker.nextElementSibling.style.display = "";
        if (format === "mixed") {
          format = currentColor.a === 1 ? "hex" : "rgb";
        } else if (format === "auto") {
          format = currentFormat;
        }
        switch (format) {
          case "hex":
            colorValue.value = hex;
            break;
          case "rgb":
            colorValue.value = RGBAToStr(currentColor);
            break;
          case "hsl":
            colorValue.value = HSLAToStr(HSVAtoHSLA(currentColor));
            break;
        }
        document2.querySelector(`.clr-format [value="${format}"]`).checked = true;
      }
      function setHue() {
        const hue = hueSlider.value * 1;
        const x = colorMarker.style.left.replace("px", "") * 1;
        const y = colorMarker.style.top.replace("px", "") * 1;
        picker.style.color = `hsl(${hue}, 100%, 50%)`;
        hueMarker.style.left = `${hue / 360 * 100}%`;
        setColorAtPosition(x, y);
      }
      function setAlpha() {
        const alpha = alphaSlider.value / 100;
        alphaMarker.style.left = `${alpha * 100}%`;
        updateColor({ a: alpha });
        pickColor();
      }
      function HSVAtoRGBA(hsva) {
        const saturation = hsva.s / 100;
        const value = hsva.v / 100;
        let chroma = saturation * value;
        let hueBy60 = hsva.h / 60;
        let x = chroma * (1 - Math2.abs(hueBy60 % 2 - 1));
        let m = value - chroma;
        chroma = chroma + m;
        x = x + m;
        const index = Math2.floor(hueBy60) % 6;
        const red = [chroma, x, m, m, x, chroma][index];
        const green = [x, chroma, chroma, x, m, m][index];
        const blue = [m, m, x, chroma, chroma, x][index];
        return {
          r: Math2.round(red * 255),
          g: Math2.round(green * 255),
          b: Math2.round(blue * 255),
          a: hsva.a
        };
      }
      function HSVAtoHSLA(hsva) {
        const value = hsva.v / 100;
        const lightness = value * (1 - hsva.s / 100 / 2);
        let saturation;
        if (lightness > 0 && lightness < 1) {
          saturation = Math2.round((value - lightness) / Math2.min(lightness, 1 - lightness) * 100);
        }
        return {
          h: hsva.h,
          s: saturation || 0,
          l: Math2.round(lightness * 100),
          a: hsva.a
        };
      }
      function RGBAtoHSVA(rgba) {
        const red = rgba.r / 255;
        const green = rgba.g / 255;
        const blue = rgba.b / 255;
        const xmax = Math2.max(red, green, blue);
        const xmin = Math2.min(red, green, blue);
        const chroma = xmax - xmin;
        const value = xmax;
        let hue = 0;
        let saturation = 0;
        if (chroma) {
          if (xmax === red) {
            hue = (green - blue) / chroma;
          }
          if (xmax === green) {
            hue = 2 + (blue - red) / chroma;
          }
          if (xmax === blue) {
            hue = 4 + (red - green) / chroma;
          }
          if (xmax) {
            saturation = chroma / xmax;
          }
        }
        hue = Math2.floor(hue * 60);
        return {
          h: hue < 0 ? hue + 360 : hue,
          s: Math2.round(saturation * 100),
          v: Math2.round(value * 100),
          a: rgba.a
        };
      }
      function strToRGBA(str) {
        const regex = /^((rgba)|rgb)[\D]+([\d.]+)[\D]+([\d.]+)[\D]+([\d.]+)[\D]*?([\d.]+|$)/i;
        let match, rgba;
        ctx.fillStyle = "#000";
        ctx.fillStyle = str;
        match = regex.exec(ctx.fillStyle);
        if (match) {
          rgba = {
            r: match[3] * 1,
            g: match[4] * 1,
            b: match[5] * 1,
            a: match[6] * 1
          };
        } else {
          match = ctx.fillStyle.replace("#", "").match(/.{2}/g).map((h) => parseInt(h, 16));
          rgba = {
            r: match[0],
            g: match[1],
            b: match[2],
            a: 1
          };
        }
        return rgba;
      }
      function RGBAToHex(rgba) {
        let R = rgba.r.toString(16);
        let G = rgba.g.toString(16);
        let B = rgba.b.toString(16);
        let A = "";
        if (rgba.r < 16) {
          R = "0" + R;
        }
        if (rgba.g < 16) {
          G = "0" + G;
        }
        if (rgba.b < 16) {
          B = "0" + B;
        }
        if (settings.alpha && (rgba.a < 1 || settings.forceAlpha)) {
          const alpha = rgba.a * 255 | 0;
          A = alpha.toString(16);
          if (alpha < 16) {
            A = "0" + A;
          }
        }
        return "#" + R + G + B + A;
      }
      function RGBAToStr(rgba) {
        if (!settings.alpha || rgba.a === 1 && !settings.forceAlpha) {
          return `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
        } else {
          return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
        }
      }
      function HSLAToStr(hsla) {
        if (!settings.alpha || hsla.a === 1 && !settings.forceAlpha) {
          return `hsl(${hsla.h}, ${hsla.s}%, ${hsla.l}%)`;
        } else {
          return `hsla(${hsla.h}, ${hsla.s}%, ${hsla.l}%, ${hsla.a})`;
        }
      }
      function init() {
        if (document2.getElementById("clr-picker")) return;
        container = undefined2;
        picker = document2.createElement("div");
        picker.setAttribute("id", "clr-picker");
        picker.className = "clr-picker";
        picker.innerHTML = `<input id="clr-color-value" name="clr-color-value" class="clr-color" type="text" value="" spellcheck="false" aria-label="${settings.a11y.input}"><div id="clr-color-area" class="clr-gradient" role="application" aria-label="${settings.a11y.instruction}"><div id="clr-color-marker" class="clr-marker" tabindex="0"></div></div><div class="clr-hue"><input id="clr-hue-slider" name="clr-hue-slider" type="range" min="0" max="360" step="1" aria-label="${settings.a11y.hueSlider}"><div id="clr-hue-marker"></div></div><div class="clr-alpha"><input id="clr-alpha-slider" name="clr-alpha-slider" type="range" min="0" max="100" step="1" aria-label="${settings.a11y.alphaSlider}"><div id="clr-alpha-marker"></div><span></span></div><div id="clr-format" class="clr-format"><fieldset class="clr-segmented"><legend>${settings.a11y.format}</legend><input id="clr-f1" type="radio" name="clr-format" value="hex"><label for="clr-f1">Hex</label><input id="clr-f2" type="radio" name="clr-format" value="rgb"><label for="clr-f2">RGB</label><input id="clr-f3" type="radio" name="clr-format" value="hsl"><label for="clr-f3">HSL</label><span></span></fieldset></div><div id="clr-swatches" class="clr-swatches"></div><button type="button" id="clr-clear" class="clr-clear" aria-label="${settings.a11y.clear}">${settings.clearLabel}</button><div id="clr-color-preview" class="clr-preview"><button type="button" id="clr-close" class="clr-close" aria-label="${settings.a11y.close}">${settings.closeLabel}</button></div><span id="clr-open-label" hidden>${settings.a11y.open}</span><span id="clr-swatch-label" hidden>${settings.a11y.swatch}</span>`;
        document2.body.appendChild(picker);
        colorArea = getEl("clr-color-area");
        colorMarker = getEl("clr-color-marker");
        clearButton = getEl("clr-clear");
        closeButton = getEl("clr-close");
        colorPreview = getEl("clr-color-preview");
        colorValue = getEl("clr-color-value");
        hueSlider = getEl("clr-hue-slider");
        hueMarker = getEl("clr-hue-marker");
        alphaSlider = getEl("clr-alpha-slider");
        alphaMarker = getEl("clr-alpha-marker");
        bindFields(settings.el);
        wrapFields(settings.el);
        addListener(picker, "mousedown", (event) => {
          picker.classList.remove("clr-keyboard-nav");
          event.stopPropagation();
        });
        addListener(colorArea, "mousedown", (event) => {
          addListener(document2, "mousemove", moveMarker);
        });
        addListener(colorArea, "contextmenu", (event) => {
          event.preventDefault();
        });
        addListener(colorArea, "touchstart", (event) => {
          document2.addEventListener("touchmove", moveMarker, { passive: false });
        });
        addListener(colorMarker, "mousedown", (event) => {
          addListener(document2, "mousemove", moveMarker);
        });
        addListener(colorMarker, "touchstart", (event) => {
          document2.addEventListener("touchmove", moveMarker, { passive: false });
        });
        addListener(colorValue, "change", (event) => {
          const value = colorValue.value;
          if (currentEl || settings.inline) {
            const color = value === "" ? value : setColorFromStr(value);
            pickColor(color);
          }
        });
        addListener(clearButton, "click", (event) => {
          pickColor("");
          closePicker();
        });
        addListener(closeButton, "click", (event) => {
          pickColor();
          closePicker();
        });
        addListener(getEl("clr-format"), "click", ".clr-format input", (event) => {
          currentFormat = event.target.value;
          updateColor();
          pickColor();
        });
        addListener(picker, "click", ".clr-swatches button", (event) => {
          setColorFromStr(event.target.textContent);
          pickColor();
          if (settings.swatchesOnly) {
            closePicker();
          }
        });
        addListener(document2, "mouseup", (event) => {
          document2.removeEventListener("mousemove", moveMarker);
        });
        addListener(document2, "touchend", (event) => {
          document2.removeEventListener("touchmove", moveMarker);
        });
        addListener(document2, "mousedown", (event) => {
          keyboardNav = false;
          picker.classList.remove("clr-keyboard-nav");
          closePicker();
        });
        addListener(document2, "keydown", (event) => {
          const key = event.key;
          const target = event.target;
          const shiftKey = event.shiftKey;
          const navKeys = ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
          if (key === "Escape") {
            closePicker(true);
            return;
          } else if (key === "Enter" && target.tagName !== "BUTTON") {
            closePicker();
            return;
          } else if (navKeys.includes(key)) {
            keyboardNav = true;
            picker.classList.add("clr-keyboard-nav");
          }
          if (key === "Tab" && target.matches(".clr-picker *")) {
            const focusables = getFocusableElements();
            const firstFocusable = focusables.shift();
            const lastFocusable = focusables.pop();
            if (shiftKey && target === firstFocusable) {
              lastFocusable.focus();
              event.preventDefault();
            } else if (!shiftKey && target === lastFocusable) {
              firstFocusable.focus();
              event.preventDefault();
            }
          }
        });
        addListener(document2, "click", ".clr-field button", (event) => {
          if (hasInstance) {
            resetVirtualInstance();
          }
          event.target.nextElementSibling.dispatchEvent(new Event("click", { bubbles: true }));
        });
        addListener(colorMarker, "keydown", (event) => {
          const movements = {
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0]
          };
          if (Object.keys(movements).includes(event.key)) {
            moveMarkerOnKeydown(...movements[event.key]);
            event.preventDefault();
          }
        });
        addListener(colorArea, "click", moveMarker);
        addListener(hueSlider, "input", setHue);
        addListener(alphaSlider, "input", setAlpha);
      }
      function getFocusableElements() {
        const controls = Array.from(picker.querySelectorAll("input, button"));
        const focusables = controls.filter((node) => !!node.offsetWidth);
        return focusables;
      }
      function getEl(id) {
        return document2.getElementById(id);
      }
      function addListener(context, type, selector, fn) {
        const matches = Element.prototype.matches || Element.prototype.msMatchesSelector;
        if (typeof selector === "string") {
          context.addEventListener(type, (event) => {
            if (matches.call(event.target, selector)) {
              fn.call(event.target, event);
            }
          });
        } else {
          fn = selector;
          context.addEventListener(type, fn);
        }
      }
      function DOMReady(fn, args) {
        args = args !== undefined2 ? args : [];
        if (document2.readyState !== "loading") {
          fn(...args);
        } else {
          document2.addEventListener("DOMContentLoaded", () => {
            fn(...args);
          });
        }
      }
      if (NodeList !== undefined2 && NodeList.prototype && !NodeList.prototype.forEach) {
        NodeList.prototype.forEach = Array.prototype.forEach;
      }
      function setColor(color, target) {
        currentEl = target;
        oldColor = currentEl.value;
        attachVirtualInstance(target);
        currentFormat = getColorFormatFromStr(color);
        updatePickerPosition();
        setColorFromStr(color);
        pickColor();
        if (oldColor !== color) {
          currentEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      const Coloris2 = (() => {
        const methods = {
          init,
          set: configure,
          wrap: wrapFields,
          close: closePicker,
          setInstance: setVirtualInstance,
          setColor,
          removeInstance: removeVirtualInstance,
          updatePosition: updatePickerPosition,
          ready: DOMReady
        };
        function Coloris3(options) {
          DOMReady(() => {
            if (options) {
              if (typeof options === "string") {
                bindFields(options);
              } else {
                configure(options);
              }
            }
          });
        }
        for (const key in methods) {
          Coloris3[key] = function() {
            for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
              args[_key] = arguments[_key];
            }
            DOMReady(methods[key], args);
          };
        }
        DOMReady(() => {
          window2.addEventListener("resize", (event) => {
            Coloris3.updatePosition();
          });
          window2.addEventListener("scroll", (event) => {
            Coloris3.updatePosition();
          });
        });
        return Coloris3;
      })();
      Coloris2.coloris = Coloris2;
      return Coloris2;
    })(window, document, Math);
  })();
  var _coloris = Coloris.coloris;
  var _init = Coloris.init;
  var _set = Coloris.set;
  var _wrap = Coloris.wrap;
  var _close = Coloris.close;
  var _setInstance = Coloris.setInstance;
  var _removeInstance = Coloris.removeInstance;
  var _updatePosition = Coloris.updatePosition;
  var coloris_default = Coloris;

  // src/core.js
  var DATA_KEY = "scCalendarData";
  var DATA_VERSION = 4;
  var FILTER_MODES = Object.freeze(["all", "pending", "done"]);
  var CONTROL_SCALE_RANGE = Object.freeze({ min: 80, max: 120, step: 5 });
  var DEFAULT_SETTINGS = Object.freeze({ hide: false, dim: true, filter: "all", accentColor: "#0a84ff", controlScale: 100, showHideDone: true, showFadeDone: true, showResetView: true, moveMode: false, controlPosition: Object.freeze({ right: 12, bottom: 70 }) });
  function accentForeground(value) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
    if (!match) return "#ffffff";
    const channels = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    const blackContrast = (luminance + 0.05) / 0.05;
    const whiteContrast = 1.05 / (luminance + 0.05);
    return blackContrast >= whiteContrast ? "#000000" : "#ffffff";
  }
  var LEGACY_KEYS = Object.freeze({
    states: "sc_cal_checkbox_states_calendar_only",
    settings: "sc_cal_checkbox_settings_calendar_only",
    idMap: "sc_cal_idmap_calendar_only_v2"
  });

  // src/storage-protocol.js
  var STORAGE_MESSAGE_TYPE = "assignmark:storage";

  // src/storage-client.js
  function cleanRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  }
  function cleanSnapshot(value) {
    const snapshot = cleanRecord(value);
    return {
      version: Number(snapshot.version) || DATA_VERSION,
      states: cleanRecord(snapshot.states),
      stateVersions: cleanRecord(snapshot.stateVersions),
      settings: { ...DEFAULT_SETTINGS, ...cleanRecord(snapshot.settings) },
      idMap: cleanRecord(snapshot.idMap)
    };
  }
  var StorageClient = class {
    constructor(sendMessage) {
      if (typeof sendMessage !== "function") throw new TypeError("A sendMessage function is required.");
      this.sendMessage = sendMessage;
      this.data = cleanSnapshot();
      this.initialized = false;
    }
    async request(operation, payload = {}) {
      const response = await this.sendMessage({ type: STORAGE_MESSAGE_TYPE, operation, ...payload });
      if (response?.ok === false) throw new Error(response.error || "Extension storage request failed.");
      if (!response?.snapshot) throw new Error("Extension storage returned no snapshot.");
      this.data = cleanSnapshot(response.snapshot);
      this.initialized = true;
      return response.result;
    }
    initialize(legacyData = void 0) {
      return this.request("initialize", { legacyData }).then(() => this.snapshot());
    }
    snapshot() {
      return structuredClone(this.data);
    }
    replaceSnapshot(snapshot) {
      this.data = cleanSnapshot(snapshot);
      this.initialized = true;
      return this.snapshot();
    }
    getSettings() {
      return { ...this.data.settings };
    }
    isChecked(id) {
      return Boolean(id && this.data.states[id]);
    }
    checkedIds() {
      return Object.keys(this.data.states).filter((id) => Boolean(this.data.states[id]));
    }
    checkedSnapshot(ids = this.checkedIds()) {
      const states = {};
      for (const id of new Set(Array.isArray(ids) ? ids : [])) {
        if (this.data.states[id]) states[id] = this.data.states[id];
      }
      return states;
    }
    setChecked(id, checked, timestamp = Date.now()) {
      return this.request("setChecked", { id, checked, timestamp });
    }
    updateSettings(patch) {
      return this.request("updateSettings", { patch });
    }
    resetSettings() {
      return this.request("resetSettings");
    }
    resolve(candidates) {
      return this.request("resolve", { candidates });
    }
    resolveMany(candidatesList) {
      return this.request("resolveMany", { candidatesList });
    }
    clearCompleted(expectedStates) {
      return this.request("clearCompleted", { expectedStates });
    }
    clearAllStates(expectedStates) {
      return this.request("clearAllStates", { expectedStates });
    }
    restoreStates(snapshot) {
      return this.request("restoreStates", { snapshot });
    }
  };

  // src/popup-ui.js
  var ACCENT_SWATCHES = Object.freeze([
    "#0a84ff",
    "#0078d4",
    "#5856d6",
    "#af52de",
    "#ff2d55",
    "#30b866"
  ]);
  function createSettingsPopup(doc, callbacks = {}) {
    const shell = doc.createElement("div");
    shell.className = "popup-shell";
    shell.innerHTML = `
    <header class="popup-header">
      <img src="../icons/icon48.png" width="38" height="38" alt="">
      <div>
        <h1>Assignmark</h1>
        <p>Calendar checkoffs</p>
      </div>
    </header>

    <section class="settings-card" data-section="view">
      <div class="section-heading">
        <div>
          <h2>Calendar view</h2>
          <p>Choose which assignments appear.</p>
        </div>
      </div>
      <div class="segmented-control" role="group" aria-label="Calendar item filter">
        <button type="button" data-filter="all" aria-pressed="true">All</button>
        <button type="button" data-filter="pending" aria-pressed="false">To do</button>
        <button type="button" data-filter="done" aria-pressed="false">Done</button>
      </div>
    </section>

    <section class="settings-card" data-section="appearance">
      <div class="section-heading">
        <div>
          <h2>Appearance</h2>
          <p>Keep the calendar calm and personal.</p>
        </div>
      </div>

      <button type="button" class="settings-row switch-row" data-role="fade-completed" role="switch" aria-checked="true">
        <span>
          <strong>Fade completed</strong>
          <small>Makes checked items lighter and strikes them through. It never deletes a checkmark.</small>
        </span>
        <span class="switch" aria-hidden="true"><span></span></span>
      </button>

      <div class="color-setting">
        <div class="color-copy">
          <label for="sc-accent">Accent color</label>
          <small>Used for checkboxes and active controls.</small>
        </div>
        <div class="color-field-wrap">
          <span class="color-preview" data-role="color-preview" aria-hidden="true"></span>
          <input id="sc-accent" data-role="accent-color" type="text" inputmode="text" autocomplete="off" spellcheck="false" aria-label="Accent color hex value">
        </div>
      </div>

      <div class="swatches" role="group" aria-label="Accent color presets">
        ${ACCENT_SWATCHES.map((color) => `<button type="button" data-accent="${color}" aria-label="Use accent color ${color}" style="--swatch:${color}"></button>`).join("")}
      </div>

      <div class="control-preferences" data-role="control-preferences">
        <strong>Calendar controls</strong>
        <label class="visibility-option"><input type="checkbox" data-control-visibility="hideDone"> <span>Show Hide done</span></label>
        <label class="visibility-option"><input type="checkbox" data-control-visibility="fadeDone"> <span>Show Fade done</span></label>
        <label class="visibility-option"><input type="checkbox" data-control-visibility="resetView"> <span>Show Reset view</span></label>
        <label class="size-setting" for="control-scale"><span>Button size <output data-role="control-scale-value">100%</output></span><input id="control-scale" data-role="control-scale" type="range" min="80" max="120" step="5" value="100"></label>
        <button type="button" class="secondary-button" data-role="move-controls">Move controls</button>
      </div>
    </section>

    <section class="settings-card danger-card" data-section="data">
      <div class="section-heading">
        <div>
          <h2>Saved checkoffs</h2>
          <p>These actions change stored completion data.</p>
        </div>
      </div>
      <button type="button" class="danger-button" data-role="reset-all" disabled>Reset all checkoffs</button>
      <p class="reset-explanation" data-role="reset-all-explanation">No saved checkoffs to reset.</p>
      <button type="button" class="secondary-button" data-role="undo" hidden>Undo reset</button>
    </section>

    <button type="button" class="secondary-button reset-settings-button" data-role="reset-settings">Reset settings to defaults</button>
    <p class="reset-explanation">Resets appearance, button visibility, size, and position. Saved checkoffs stay unchanged.</p>

    <p class="popup-status" data-role="status" role="status" aria-live="polite"></p>
    <footer>Stored locally. No analytics or external requests.</footer>
  `;
    const filterButtons = [...shell.querySelectorAll("[data-filter]")];
    const fadeButton = shell.querySelector('[data-role="fade-completed"]');
    const accentInput = shell.querySelector('[data-role="accent-color"]');
    const colorPreview = shell.querySelector('[data-role="color-preview"]');
    const resetAll = shell.querySelector('[data-role="reset-all"]');
    const resetExplanation = shell.querySelector('[data-role="reset-all-explanation"]');
    const undo = shell.querySelector('[data-role="undo"]');
    const resetSettings = shell.querySelector('[data-role="reset-settings"]');
    const moveControls = shell.querySelector('[data-role="move-controls"]');
    const controlScale = shell.querySelector('[data-role="control-scale"]');
    const controlScaleValue = shell.querySelector('[data-role="control-scale-value"]');
    const status = shell.querySelector('[data-role="status"]');
    let currentDim = true;
    for (const button of filterButtons) {
      button.addEventListener("click", () => void callbacks.onFilterChange?.(button.dataset.filter));
    }
    fadeButton.addEventListener("click", () => void callbacks.onDimChange?.(!currentDim));
    accentInput.addEventListener("change", () => void callbacks.onAccentChange?.(accentInput.value));
    for (const swatch of shell.querySelectorAll("[data-accent]")) {
      swatch.addEventListener("click", () => void callbacks.onAccentChange?.(swatch.dataset.accent));
    }
    for (const input of shell.querySelectorAll("[data-control-visibility]")) {
      input.addEventListener("change", () => void callbacks.onControlVisibilityChange?.(input.dataset.controlVisibility, input.checked));
    }
    controlScale.addEventListener("input", () => {
      controlScaleValue.textContent = `${controlScale.value}%`;
    });
    controlScale.addEventListener("change", () => callbacks.onControlScaleChange?.(Number(controlScale.value)));
    moveControls.addEventListener("click", () => void callbacks.onMoveControls?.());
    resetSettings.addEventListener("click", () => void callbacks.onResetSettings?.());
    resetAll.addEventListener("click", () => void callbacks.onResetAll?.());
    undo.addEventListener("click", () => void callbacks.onUndo?.());
    function render({ settings = {}, checkedCount = 0, canUndo = false, resetPending = false } = {}) {
      const filter = ["all", "pending", "done"].includes(settings.filter) ? settings.filter : "all";
      currentDim = Boolean(settings.dim);
      const accentColor = /^#[0-9a-f]{6}$/i.test(String(settings.accentColor || "")) ? String(settings.accentColor).toLowerCase() : "#0a84ff";
      for (const button of filterButtons) {
        button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
      }
      fadeButton.setAttribute("aria-checked", String(currentDim));
      accentInput.value = accentColor;
      colorPreview.style.background = accentColor;
      shell.style.setProperty("--accent", accentColor);
      shell.style.setProperty("--accent-foreground", accentForeground(accentColor));
      const visibility = {
        hideDone: settings.showHideDone !== false,
        fadeDone: settings.showFadeDone !== false,
        resetView: settings.showResetView !== false
      };
      for (const input of shell.querySelectorAll("[data-control-visibility]")) input.checked = visibility[input.dataset.controlVisibility];
      controlScale.value = String(Math.min(120, Math.max(80, Number(settings.controlScale) || 100)));
      controlScaleValue.textContent = `${controlScale.value}%`;
      moveControls.textContent = settings.moveMode ? "Moving controls\u2026" : "Move controls";
      moveControls.disabled = Boolean(settings.moveMode);
      const count = Math.max(0, Number(checkedCount) || 0);
      resetAll.disabled = resetPending || count === 0;
      resetAll.setAttribute("aria-busy", String(Boolean(resetPending)));
      resetAll.setAttribute("aria-label", count === 0 ? "Reset all checkoffs unavailable because none are saved" : `Reset all ${count} saved checkoffs across every calendar date`);
      resetExplanation.textContent = count === 0 ? "No saved checkoffs to reset." : `Removes ${count} saved checkoff${count === 1 ? "" : "s"} from every calendar date.`;
      undo.hidden = !canUndo;
      undo.disabled = Boolean(resetPending);
    }
    function setStatus(message = "", tone = "neutral") {
      status.textContent = message;
      status.dataset.tone = tone;
    }
    return { element: shell, render, setStatus };
  }

  // src/reset-action.js
  function createResetOperation({
    getExpectedStates,
    confirmAction = () => true,
    clear,
    onPendingChange = () => {
    },
    onSuccess = () => {
    },
    onZeroResult = () => {
    },
    onError = () => {
    }
  } = {}) {
    let pending = false;
    return async function reset() {
      if (pending) return;
      const expectedStates = getExpectedStates?.() || {};
      const expectedCount = Object.keys(expectedStates).length;
      if (expectedCount === 0 || !confirmAction(expectedCount, expectedStates)) return;
      pending = true;
      onPendingChange(true);
      try {
        const snapshot = await clear(expectedStates);
        const clearedCount = Object.keys(snapshot?.states || {}).length;
        if (clearedCount > 0) onSuccess(snapshot, clearedCount);
        else onZeroResult();
      } catch (error) {
        onError(error);
      } finally {
        pending = false;
        onPendingChange(false);
      }
    };
  }

  // src/popup-controller.js
  async function initSettingsPopup(doc, {
    sendMessage,
    confirmAction = (message) => globalThis.confirm(message),
    subscribeStorage: subscribeStorage2
  } = {}) {
    const store = new StorageClient(sendMessage);
    let undoSnapshot = null;
    let resetPending = false;
    let popup;
    const render = () => {
      popup.render({
        settings: store.getSettings(),
        checkedCount: Object.keys(store.checkedSnapshot()).length,
        canUndo: Boolean(undoSnapshot && Object.keys(undoSnapshot.states || {}).length),
        resetPending
      });
    };
    const resetAll = createResetOperation({
      getExpectedStates: () => store.checkedSnapshot(),
      confirmAction: (count) => confirmAction(`Reset all ${count} saved checkoffs across every calendar date?`),
      clear: (expectedStates) => store.clearAllStates(expectedStates),
      onPendingChange: (pending) => {
        resetPending = pending;
        render();
      },
      onSuccess: (snapshot, count) => {
        undoSnapshot = snapshot;
        popup.setStatus(`Reset ${count} checkoff${count === 1 ? "" : "s"} from every calendar date.`, "success");
      },
      onZeroResult: () => popup.setStatus("No checkoffs were reset because the saved data changed.", "neutral"),
      onError: (error) => {
        popup.setStatus("Could not reset saved checkoffs. Try again.", "error");
        console.error("[Assignmark] Reset all failed.", error);
      }
    });
    const undo = async () => {
      if (!undoSnapshot) return;
      const snapshot = undoSnapshot;
      const count = Object.keys(snapshot.states || {}).length;
      try {
        const restored = await store.restoreStates(snapshot);
        const restoredCount = Object.keys(restored || {}).length;
        undoSnapshot = null;
        render();
        popup.setStatus(restoredCount > 0 ? `Restored ${restoredCount} checkoff${restoredCount === 1 ? "" : "s"}.` : "No checkoffs were restored because the saved data changed.", restoredCount > 0 ? "success" : "neutral");
      } catch (error) {
        popup.setStatus("Could not restore checkoffs. Try again.", "error");
        console.error("[Assignmark] Undo reset failed.", error);
      }
    };
    const updateFilter = async (filter) => {
      try {
        await store.updateSettings({ filter });
        render();
        const messages = {
          all: "Showing all calendar items.",
          pending: "Showing unfinished items.",
          done: "Showing completed items."
        };
        popup.setStatus(messages[filter] || messages.all, "success");
      } catch (error) {
        popup.setStatus("Could not update the calendar view. Try again.", "error");
        console.error("[Assignmark] Updating the calendar view failed.", error);
      }
    };
    const updateDim = async (dim) => {
      try {
        await store.updateSettings({ dim });
        render();
        popup.setStatus(dim ? "Completed items now fade without being hidden or unchecked." : "Completed items now stay at full brightness.", "success");
      } catch (error) {
        popup.setStatus("Could not update the Fade completed setting. Try again.", "error");
        console.error("[Assignmark] Updating Fade completed failed.", error);
      }
    };
    const updateAccent = async (value) => {
      const accentColor = String(value || "").toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(accentColor)) {
        render();
        popup.setStatus("Enter a six-digit hex color, such as #0078d4.", "error");
        return;
      }
      try {
        await store.updateSettings({ accentColor });
        render();
        popup.setStatus("Accent color updated.", "success");
      } catch (error) {
        popup.setStatus("Could not update the accent color. Try again.", "error");
        console.error("[Assignmark] Updating the accent color failed.", error);
      }
    };
    const updateControlSetting = async (key, value, message) => {
      try {
        await store.updateSettings({ [key]: value });
        render();
        popup.setStatus(message, "success");
      } catch (error) {
        render();
        popup.setStatus("Could not update calendar controls. Try again.", "error");
        console.error("[Assignmark] Updating calendar controls failed.", error);
      }
    };
    const resetSettings = async () => {
      if (!confirmAction("Reset Assignmark appearance, button visibility, size, and position to defaults? Saved checkoffs will not be deleted.")) return;
      try {
        await store.resetSettings();
        render();
        popup.setStatus("Settings reset to defaults. Saved checkoffs were kept.", "success");
      } catch (error) {
        popup.setStatus("Could not reset settings. Try again.", "error");
        console.error("[Assignmark] Resetting settings failed.", error);
      }
    };
    popup = createSettingsPopup(doc, {
      onFilterChange: updateFilter,
      onDimChange: updateDim,
      onAccentChange: updateAccent,
      onControlVisibilityChange: (name, visible) => updateControlSetting(`show${name[0].toUpperCase()}${name.slice(1)}`, visible, `${name} button ${visible ? "shown" : "hidden"}.`),
      onControlScaleChange: (value) => updateControlSetting("controlScale", value, `Button size set to ${value}%.`),
      onMoveControls: () => updateControlSetting("moveMode", true, "Move mode enabled on the calendar. Drag the highlighted rail and lock it there."),
      onResetSettings: resetSettings,
      onResetAll: resetAll,
      onUndo: undo
    });
    doc.querySelector("#app")?.appendChild(popup.element);
    await store.initialize();
    render();
    subscribeStorage2?.((snapshot) => {
      store.replaceSnapshot(snapshot);
      render();
    });
    return { popup, store };
  }

  // src/popup.js
  function subscribeStorage(callback) {
    const listener = (changes, areaName) => {
      if (areaName === "local" && changes[DATA_KEY]?.newValue) callback(changes[DATA_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(listener);
  }
  async function start() {
    coloris_default.init();
    await initSettingsPopup(document, {
      sendMessage: (message) => chrome.runtime.sendMessage(message),
      confirmAction: (message) => window.confirm(message),
      subscribeStorage
    });
    coloris_default({
      el: "#sc-accent",
      theme: "polaroid",
      themeMode: "auto",
      format: "hex",
      alpha: false,
      swatches: ["#0a84ff", "#0078d4", "#5856d6", "#af52de", "#ff2d55", "#30b866"]
    });
    document.querySelector("#app")?.setAttribute("aria-busy", "false");
  }
  void start().catch((error) => {
    console.error("[Assignmark] Settings popup failed to start.", error);
    const root = document.querySelector("#app");
    if (root) {
      root.setAttribute("aria-busy", "false");
      root.textContent = "Assignmark settings could not load. Close this popup and try again.";
    }
  });
})();
