// Shared data layer for the two guide-list views:
//   - GuideBrowser (modal)
//   - GuideLibrary (full-page)
//
// Both need the same three things:
//   1. Load the manifest of available guides (listGuides).
//   2. Load a single guide's payload (loadGuide) and hand it upward.
//   3. Report where the list came from (remote / local / fallback).
//
// This module exposes a plain Options-API mixin so both components can
// `mixins: [GuideListMixin]` and get identical behavior with no
// copy-paste. It also gives them a single place to change if the
// fallback strategy or error message ever needs updating.

import { listGuides, loadGuide } from "./guides.js";

export const GuideListMixin = {
  data() {
    return {
      // Data
      loading: false,
      error: "",
      guides: [],
      source: null,          // "remote" | "local" | "fallback" | null
      loadingFile: null      // filename currently being opened, or null
    };
  },
  computed: {
    sourceLabel() {
      if (this.source === "remote") return "Loaded from github.com/rndfunction/SideboardGuides";
      if (this.source === "local") return "Loaded from the app's local mirror (remote unavailable)";
      if (this.source === "fallback") return "Showing built-in sample guides (remote and local fetches unavailable)";
      return "";
    }
  },
  methods: {
    /**
     * Fetch the manifest and update guides + source. Sets loading/error
     * state so both views can render consistent spinners and messages.
     */
    async refreshGuides() {
      this.loading = true;
      this.error = "";
      try {
        const result = await listGuides();
        this.guides = (result && result.guides) || [];
        this.source = result ? result.source : null;
      } catch (err) {
        this.error = "Could not load guides: " + String((err && err.message) || err);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Fetch a single guide by filename, validate its format, and emit it
     * to the parent as "load-share". Re-entrant calls are ignored while a
     * load is in flight so double-clicks don't fire twice.
     */
    async openGuide(file, emit) {
      if (this.loadingFile) return;
      this.loadingFile = file;
      this.error = "";
      try {
        const payload = await loadGuide(file);
        if (!payload || payload.format !== "mtg-sideboard-guide") {
          throw new Error("Not a valid guide file.");
        }
        emit("load-share", payload);
      } catch (err) {
        this.error = "Could not load guide: " + String((err && err.message) || err);
      } finally {
        this.loadingFile = null;
      }
    }
  }
};