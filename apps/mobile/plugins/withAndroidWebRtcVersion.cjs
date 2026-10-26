const { withAppBuildGradle } = require("expo/config-plugins");

const START = "// @generated begin mines-webrtc-version";
const END = "// @generated end mines-webrtc-version";
const BLOCK = `${START}
// The Dav1d JNI packaging exception is audited against this exact artifact.
configurations.configureEach {
    resolutionStrategy.force 'org.jitsi:webrtc:155.0.1'
}
${END}`;

function pinWebRtc(contents) {
  const start = contents.indexOf(START);
  const end = contents.indexOf(END);
  if (start === -1 && end === -1) return `${contents.trimEnd()}\n\n${BLOCK}\n`;
  if (
    start === -1 ||
    end < start ||
    contents.indexOf(START, start + START.length) !== -1 ||
    contents.indexOf(END, end + END.length) !== -1
  ) {
    throw new Error("withAndroidWebRtcVersion: malformed managed Gradle block.");
  }
  return contents.slice(0, start) + BLOCK + contents.slice(end + END.length);
}

module.exports = function withAndroidWebRtcVersion(config) {
  return withAppBuildGradle(config, (nextConfig) => {
    if (nextConfig.modResults.language !== "groovy") {
      throw new Error("withAndroidWebRtcVersion: app build.gradle must use Groovy.");
    }
    nextConfig.modResults.contents = pinWebRtc(nextConfig.modResults.contents);
    return nextConfig;
  });
};

module.exports.pinWebRtc = pinWebRtc;
