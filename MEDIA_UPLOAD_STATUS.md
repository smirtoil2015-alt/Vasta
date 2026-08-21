# Vasta media phase

The media backend is prepared for conversation images, videos, and PDF files.

- Maximum file size: 25 MB.
- Supported types: images, videos, PDF.
- Storage paths are scoped to conversation participants.
- Media message metadata is stored in the conversation message document.
- The reusable `MediaPicker` component is ready for the composer integration.

The composer UI still needs the final wiring to call `uploadConversationMedia` and `sendMediaMessage` before this phase is considered production-ready.
