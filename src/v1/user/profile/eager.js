export default {
  avatar: [
    // High-resolution display (WebP)
    {
      transformation: [
        { width: 256, height: 256, crop: "thumb", gravity: "face" },
        { radius: "max" }, // Circular crop
        { quality: "auto:best", fetch_format: "webp" },
      ],
    },
    // Tiny thumbnail
    {
      transformation: [
        { width: 64, height: 64, crop: "thumb", gravity: "face" },
        { radius: "max" },
        { quality: "auto:low", fetch_format: "webp" },
      ],
    },
    // Fallback (JPG for older browsers)
    {
      transformation: [
        { width: 256, height: 256, crop: "thumb", gravity: "face" },
        { radius: "max" },
        { quality: 80, fetch_format: "jpg" },
      ],
    },
  ],
  backgroundAvatar: [
    // Main profile display (webp for best quality/size ratio)
    {
      transformation: [
        { width: 600, height: 240, crop: "fill" },
        { quality: "auto", fetch_format: "webp" },
      ],
    },

    // Blurred background effect
    {
      transformation: [
        { width: 800, height: 320, crop: "fill" },
        { effect: "blur:1000" },
        { quality: 30, fetch_format: "webp" }, // Low quality for blurred
      ],
    },
  ],
};
