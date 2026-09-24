// DeviceAuthDialog: modal that runs the GitHub OAuth device flow.
//
// On open, requests a user code from GitHub, displays it with a link to
// the verification page, then polls for the token. On success emits
// "authorized" with the token. On error shows a retry button.

import { requestDeviceCode, pollForToken } from "../githubauth.js";

const DeviceAuthDialog = {
  props: {
    open: { type: Boolean, default: false }
  },
  emits: ["authorized", "close"],
  data() {
    return {
      status: "idle", // idle | loading | waiting | ready | error
      userCode: "",
      verificationUri: "https://github.com/login/device",
      errorMessage: "",
      copied: false,
      _pollAbort: false
    };
  },
  watch: {
    open(newVal) {
      if (newVal) this.start();
      else this._pollAbort = true;
    }
  },
  beforeUnmount() {
    this._pollAbort = true;
  },
  methods: {
    async start() {
      this.status = "loading";
      this.errorMessage = "";
      this.userCode = "";
      this.copied = false;
      this._pollAbort = false;

      let codeData;
      try {
        codeData = await requestDeviceCode();
      } catch (err) {
        this.status = "error";
        this.errorMessage = String(err.message || err);
        return;
      }

      if (this._pollAbort) return;

      this.userCode = codeData.user_code;
      this.verificationUri = codeData.verification_uri || "https://github.com/login/device";
      this.status = "waiting";

      try {
        const token = await pollForToken(
          codeData.device_code,
          codeData.interval,
          codeData.expires_in,
          (s) => {
            // Progress callbacks can only move us forward.
            if (!this._pollAbort && s === "polling") this.status = "waiting";
          }
        );
        if (this._pollAbort) return;
        this.status = "ready";
        this.$emit("authorized", token);
      } catch (err) {
        if (this._pollAbort) return;
        this.status = "error";
        this.errorMessage = String(err.message || err);
      }
    },
    async copyCode() {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(this.userCode);
          this.copied = true;
          setTimeout(() => { this.copied = false; }, 2000);
        }
      } catch (_) {
        // Clipboard may be blocked; the user can select the text manually.
      }
    },
    openVerification() {
      window.open(this.verificationUri, "_blank", "noopener");
    },
    onClose() {
      this._pollAbort = true;
      this.$emit("close");
    },
    onOverlayClick(evt) {
      if (evt.target === evt.currentTarget) this.onClose();
    },
    onRetry() {
      this.start();
    }
  },
  template: `
    <div
      v-if="open"
      class="device-auth-overlay"
      @click="onOverlayClick"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in with GitHub"
    >
      <div class="device-auth-panel">
        <header class="device-auth-header">
          <h2>Sign in with GitHub</h2>
          <button
            type="button"
            class="device-auth-close"
            @click="onClose"
            aria-label="Close"
            title="Close"
          >&times;</button>
        </header>

        <div v-if="status === 'loading'" class="device-auth-status">
          Requesting a device code...
        </div>

        <div v-else-if="status === 'error'" class="device-auth-status device-auth-error">
          <p>{{ errorMessage }}</p>
          <button type="button" class="usa-button" @click="onRetry">Try again</button>
        </div>

        <div v-else class="device-auth-body">
          <p class="device-auth-instructions">
            To submit your guide, sign in to GitHub and enter this code:
          </p>
          <div class="device-auth-code" aria-label="Your device code">{{ userCode }}</div>
          <div class="device-auth-actions">
            <button
              type="button"
              class="usa-button usa-button--outline"
              @click="copyCode"
            >{{ copied ? "Copied!" : "Copy code" }}</button>
            <button
              type="button"
              class="usa-button"
              @click="openVerification"
            >Open github.com/login/device</button>
          </div>
          <p class="device-auth-waiting" v-if="status === 'waiting'">
            Waiting for you to authorize...
          </p>
          <p class="device-auth-waiting" v-else-if="status === 'ready'">
            Authorized. Submitting your guide...
          </p>
        </div>
      </div>
    </div>
  `
};

export default DeviceAuthDialog;