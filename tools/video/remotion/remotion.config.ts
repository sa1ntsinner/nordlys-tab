/**
 * Used by the Remotion CLI (studio and render); the Node APIs take these as
 * options instead. https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// The effects (zoom blur, light leak, glow) draw with WebGL2.
Config.setChromiumOpenGlRenderer("angle");
Config.setPublicDir("public");
