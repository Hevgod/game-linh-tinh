export class Controls {
  constructor(canvas, mobileUi) {
    this.keys = new Set();
    this.touchX = 0;
    this.jumpQueued = false;
    this.fireQueued = false;
    this.fireTouch = false;
    this.touchFired = false;
    this.reloadQueued = false;
    this.aim = null;
    this.stickPointer = null;
    this.canvas = canvas;
    this.stickZone = mobileUi.stickZone;
    this.knob = mobileUi.knob;
    this.jumpButton = mobileUi.jumpButton;
    this.fireButton = mobileUi.fireButton;
    this.reloadButton = mobileUi.reloadButton;
    this.bind();
  }

  bind() {
    window.addEventListener("keydown", event => {
      const key = event.key.toLowerCase();
      if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) event.preventDefault();
      this.keys.add(key);
    });
    window.addEventListener("keyup", event => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => this.keys.clear());

    this.stickZone.addEventListener("pointerdown", event => {
      event.preventDefault();
      this.stickPointer = event.pointerId;
      this.stickZone.setPointerCapture(event.pointerId);
      this.moveStick(event);
    });
    this.stickZone.addEventListener("pointermove", event => {
      if (event.pointerId === this.stickPointer) this.moveStick(event);
    });
    const releaseStick = event => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = null; this.touchX = 0; this.knob.style.transform = "translate(0, 0)";
    };
    this.stickZone.addEventListener("pointerup", releaseStick);
    this.stickZone.addEventListener("pointercancel", releaseStick);

    this.jumpButton.addEventListener("pointerdown", event => { event.preventDefault(); this.jumpButton.setPointerCapture(event.pointerId); this.jumpQueued = true; this.jumpButton.classList.add("pressed"); });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.jumpButton.addEventListener(eventName, () => this.jumpButton.classList.remove("pressed"));
    }
    this.fireButton.addEventListener("pointerdown", event => {
      event.preventDefault();
      this.fireButton.setPointerCapture(event.pointerId);
      this.fireTouch = true;
      this.touchFired = false;
      this.fireButton.classList.add("pressed");
    });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.fireButton.addEventListener(eventName, () => {
        if (this.fireTouch && !this.touchFired) this.fireQueued = true;
        this.fireTouch = false;
        this.fireButton.classList.remove("pressed");
      });
    }
    this.reloadButton.addEventListener("pointerdown", event => { event.preventDefault(); this.reloadQueued = true; });

    this.canvas.addEventListener("pointermove", event => {
      if (event.pointerType === "mouse") {
        const rect = this.canvas.getBoundingClientRect();
        this.aim = {
          x: (event.clientX - rect.left) / rect.width * 960,
          y: (event.clientY - rect.top) / rect.height * 540,
        };
      }
    });
    this.canvas.addEventListener("pointerleave", () => { this.aim = null; });
    this.canvas.addEventListener("contextmenu", event => event.preventDefault());
  }

  moveStick(event) {
    const rect = this.stickZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX, dy = event.clientY - centerY;
    const max = rect.width * .3, distance = Math.hypot(dx, dy), scale = distance > max ? max / distance : 1;
    this.touchX = Math.abs(dx) < 9 ? 0 : dx / max;
    this.knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }

  consumeJump() {
    const pressed = this.jumpQueued || (this.keys.has(" ") && !this.spaceWasDown);
    this.jumpQueued = false;
    this.spaceWasDown = this.keys.has(" ");
    return pressed;
  }

  consumeReload() {
    const reload = this.reloadQueued || this.keys.has("r");
    this.reloadQueued = false;
    return reload;
  }

  getInput() {
    const fire = this.keys.has("e") || this.fireTouch || this.fireQueued || this.keys.has("f");
    if (this.fireTouch) this.touchFired = true;
    this.fireQueued = false;
    return {
      x: Math.max(-1, Math.min(1, this.touchX || ((this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0)))),
      jumpHeld: this.keys.has(" ") || this.jumpButton.classList.contains("pressed"),
      jumpPressed: this.consumeJump(),
      fire,
      reload: this.consumeReload(),
      run: this.keys.has("shift"),
      aim: this.aim,
    };
  }
}
