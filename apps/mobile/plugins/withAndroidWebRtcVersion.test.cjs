const assert = require("node:assert/strict");
const { test } = require("node:test");
const { pinWebRtc } = require("./withAndroidWebRtcVersion.cjs");

test("a repeated Expo mod retains one exact WebRTC pin and existing Gradle dependencies", () => {
  const source = `plugins { id 'com.android.application' }
dependencies { implementation 'example:unrelated:2.0' }
`;
  const once = pinWebRtc(source);
  assert.equal(pinWebRtc(once), once);
  assert.ok(once.includes(source.trimEnd()));
  assert.equal(once.match(/resolutionStrategy\.force/g).length, 1);
  assert.ok(once.includes("'org.jitsi:webrtc:155.0.1'"));
});

test("prebuild replaces an outdated managed pin without dropping later Gradle settings", () => {
  const old = pinWebRtc("apply plugin: 'com.android.application'\n")
    .replace("webrtc:155.0.1", "webrtc:155.+") + "\nandroid { namespace 'app.mines' }\n";
  const updated = pinWebRtc(old);
  assert.ok(updated.includes("'org.jitsi:webrtc:155.0.1'"));
  assert.ok(!updated.includes("webrtc:155.+"));
  assert.ok(updated.endsWith("android { namespace 'app.mines' }\n"));
});

test("an interrupted generated Gradle block fails instead of duplicating a dependency rule", () => {
  assert.throws(
    () => pinWebRtc("// @generated begin mines-webrtc-version\nconfigurations {"),
    /malformed managed Gradle block/,
  );
});
