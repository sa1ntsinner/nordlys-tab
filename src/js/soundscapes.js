/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - SOUNDS FOR FOCUS
   ═══════════════════════════════════════════════════════════════════

   Made in the browser with Web Audio: no files to download, nothing to
   license, nothing sent anywhere. Each sound is a small graph of noise
   and filters that keeps changing slowly, so it never loops audibly.

     rain    pink noise through a band, and drops scattered over it
     ocean   brown noise with waves: a slow swell of level and brightness
     brown   deep, even brown noise, for blocking out a room
     wind    noise through a moving band, gusting
     aurora  a soft pad of slow chords, the sound of the videos         */
(function (root) {
  "use strict";

  const KINDS = ["rain", "ocean", "brown", "wind", "aurora"];

  function noiseBuffer(ctx, colour, seconds = 4) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (colour === "pink") {
          b0 = 0.99765 * b0 + white * 0.099;
          b1 = 0.963 * b1 + white * 0.2965;
          b2 = 0.57 * b2 + white * 1.0526;
          data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
        } else if (colour === "brown") {
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        } else data[i] = white * 0.5;
      }
      // Ends that meet, so the loop has no click.
      const fade = Math.floor(ctx.sampleRate * 0.05);
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        data[i] = data[i] * k + data[length - fade + i] * (1 - k);
      }
    }
    return buffer;
  }

  function loop(ctx, buffer) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopEnd = buffer.duration - 0.05;
    return source;
  }

  function lfo(ctx, rate, depth, target, offset = 0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = rate;
    gain.gain.value = depth;
    osc.connect(gain).connect(target);
    osc.start(ctx.currentTime + offset);
    return osc;
  }

  // Each builder wires its sound into `out` and returns what to stop.
  const BUILD = {
    rain(ctx, out) {
      const bed = loop(ctx, noiseBuffer(ctx, "pink"));
      const band = ctx.createBiquadFilter();
      band.type = "bandpass"; band.frequency.value = 1800; band.Q.value = 0.5;
      const bedGain = ctx.createGain(); bedGain.gain.value = 1.5;
      bed.connect(band).connect(bedGain).connect(out);
      const low = ctx.createBiquadFilter();
      low.type = "lowpass"; low.frequency.value = 500;
      const lowGain = ctx.createGain(); lowGain.gain.value = 0.5;
      bed.connect(low).connect(lowGain).connect(out);
      bed.start();
      // Drops: short bright ticks at random times.
      const white = noiseBuffer(ctx, "white", 1);
      let timer = 0;
      const drop = () => {
        const tick = ctx.createBufferSource();
        tick.buffer = white;
        const f = ctx.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 2500 + Math.random() * 4000; f.Q.value = 6;
        const g = ctx.createGain();
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.35, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.06);
        const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
        tick.connect(f).connect(g).connect(pan).connect(out);
        tick.start(t, Math.random() * 0.8, 0.12);
        timer = setTimeout(drop, 25 + Math.random() * 110);
      };
      drop();
      return [bed, { stop: () => clearTimeout(timer) }];
    },
    ocean(ctx, out) {
      const src = loop(ctx, noiseBuffer(ctx, "brown", 6));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 700; lp.Q.value = 0.3;
      const swell = ctx.createGain(); swell.gain.value = 0.55;
      src.connect(lp).connect(swell).connect(out);
      src.start();
      return [src, lfo(ctx, 0.09, 0.4, swell.gain), lfo(ctx, 0.09, 500, lp.frequency)];
    },
    brown(ctx, out) {
      const src = loop(ctx, noiseBuffer(ctx, "brown", 5));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0.8;
      src.connect(lp).connect(g).connect(out);
      src.start();
      return [src];
    },
    wind(ctx, out) {
      const src = loop(ctx, noiseBuffer(ctx, "pink", 5));
      const band = ctx.createBiquadFilter();
      band.type = "bandpass"; band.frequency.value = 600; band.Q.value = 2.5;
      const g = ctx.createGain(); g.gain.value = 2.2;
      src.connect(band).connect(g).connect(out);
      src.start();
      return [src, lfo(ctx, 0.07, 380, band.frequency), lfo(ctx, 0.13, 1.1, g.gain, 1.3)];
    },
    aurora(ctx, out) {
      const chords = [[50, 57, 61, 64, 69], [47, 54, 57, 62, 66], [43, 50, 54, 57, 62], [45, 52, 54, 59, 64]];
      const hz = (m) => 440 * 2 ** ((m - 69) / 12);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 1400;
      const delay = ctx.createDelay(1); delay.delayTime.value = 0.42;
      const feedback = ctx.createGain(); feedback.gain.value = 0.45;
      lp.connect(out);
      lp.connect(delay).connect(feedback).connect(delay);
      delay.connect(out);
      let step = 0;
      let timer = 0;
      const voices = new Set();
      const play = () => {
        const t = ctx.currentTime;
        for (const note of chords[step % chords.length]) {
          for (const detune of [-6, 6]) {
            const osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = hz(note);
            osc.detune.value = detune;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.035, t + 3);
            g.gain.linearRampToValueAtTime(0, t + 10);
            osc.connect(g).connect(lp);
            osc.start(t);
            osc.stop(t + 10.1);
            voices.add(osc);
            osc.onended = () => voices.delete(osc);
          }
        }
        step++;
        timer = setTimeout(play, 8000);
      };
      play();
      return [{ stop: () => { clearTimeout(timer); voices.forEach((v) => { try { v.stop(); } catch (e) {} }); } }];
    }
  };

  class NordlysSoundscapes {
    constructor() {
      this.ctx = null;
      this.kind = null;
      this.parts = [];
      this.volume = 0.5;
    }
    get playing() { return this.kind; }
    async play(kind, volume = this.volume) {
      if (!BUILD[kind]) throw new Error(`No sound called ${kind}`);
      this.stop({ fade: 0.4 });
      const AudioCtx = root.AudioContext || root.webkitAudioContext;
      if (!AudioCtx) return false;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      const master = this.ctx.createGain();
      master.gain.setValueAtTime(0, this.ctx.currentTime);
      master.gain.linearRampToValueAtTime(this.curve(volume), this.ctx.currentTime + 1.5);
      master.connect(this.ctx.destination);
      this.master = master;
      this.volume = volume;
      this.kind = kind;
      this.parts = BUILD[kind](this.ctx, master);
      return true;
    }
    // Loudness follows the ear, not the slider.
    curve(volume) { return Math.max(0, Math.min(1, volume)) ** 2; }
    setVolume(volume) {
      this.volume = volume;
      if (this.master) this.master.gain.setTargetAtTime(this.curve(volume), this.ctx.currentTime, 0.1);
    }
    stop({ fade = 0.8 } = {}) {
      if (!this.kind) return;
      const parts = this.parts;
      const master = this.master;
      const end = this.ctx.currentTime + fade;
      master.gain.cancelScheduledValues(this.ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, this.ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, end);
      setTimeout(() => {
        for (const part of parts) { try { part.stop(); } catch (e) {} }
        master.disconnect();
      }, fade * 1000 + 50);
      this.kind = null;
      this.parts = [];
      this.master = null;
    }
  }

  NordlysSoundscapes.KINDS = KINDS;
  root.NordlysSoundscapes = NordlysSoundscapes;
  if (typeof module !== "undefined" && module.exports) module.exports = NordlysSoundscapes;
})(typeof globalThis !== "undefined" ? globalThis : this);
