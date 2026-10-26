# Android WebRTC packaging exception

The inspected build resolves `react-native-webrtc@155.0.1` to
`org.jitsi:webrtc:155.0.1`. Its Android AAR contains
`org/webrtc/Dav1dDecoderJni.class`, a generated JNI wrapper, but omits both
`org/webrtc/Dav1dDecoder.class` and its nested `Natives` interface. The wrapper
therefore causes R8's missing-class check to fail under the dependency's broad
`-keep class org.webrtc.**` consumer rule.

`expo-build-properties.extraProguardRules` suppresses exactly
`org.webrtc.Dav1dDecoder$Natives`. It does not suppress other WebRTC warnings,
replace bytecode, fabricate a codec implementation, or change codec negotiation.
The idempotent `withAndroidWebRtcVersion` Expo plugin forces this same Maven
coordinate in the app's Gradle configurations, overriding the dependency's
`155.+` request. Recheck the exception and update the pin together whenever the
resolved Android WebRTC artifact changes.

## Evidence from the resolved artifact

The investigation inspected `libs/libwebrtc.jar` inside the AAR, rather than its
nearly empty top-level `classes.jar`.

| Inspected input                                | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `webrtc-155.0.1.aar`                           | `b686b7674fd7285ddda369e155ca9663b9787f2b2f470b76691980782e13cd26` |
| `libs/libwebrtc.jar`                           | `3a13ea34f793aa595857988a2350cedb7f19b3c9ad4efe6a9722a95d00ab7b6c` |
| `jni/arm64-v8a/libjingle_peerconnection_so.so` | `d3ad724257f8bc47590521ad0cfce4e654cf5f0bdc91d5e164a88a627a66f40a` |

- An exhaustive byte scan of every `.class` in `libwebrtc.jar` found the token
  `Dav1dDecoder` only in `Dav1dDecoderJni.class` and
  `org/jni_zero/GEN_JNI.class`. No Java factory or application caller references
  the absent wrapper/interface. The application sources likewise contain no such
  call.
- `javap -c -p` confirms that the JNI wrapper implements the absent interface.
  Its only native call is the corresponding declaration in `GEN_JNI`.
- The same disassembly of `SoftwareVideoDecoderFactory` shows that decoder
  enumeration and creation now use `SoftwareVideoDecoderFactoryJni` and its
  native factory. `DefaultVideoDecoderFactory` delegates to that factory and the
  hardware/platform factories; it does not instantiate a Java `Dav1dDecoder`.
- The arm64 native library contains native Dav1d implementation strings but no
  `org/webrtc/Dav1dDecoderJni` or `org/webrtc/Dav1dDecoder$Natives` class-name
  strings. This supports treating the generated Java bridge as an orphan; it
  does not establish physical-device codec interoperability.

To repeat the archive scan, supply the resolved AAR path to this Python snippet:

```python
from io import BytesIO
from zipfile import ZipFile

with ZipFile(aar_path) as aar:
    with ZipFile(BytesIO(aar.read("libs/libwebrtc.jar"))) as jar:
        references = [name for name in jar.namelist()
                      if name.endswith(".class")
                      and b"Dav1dDecoder" in jar.read(name)]
        print(references)
```

The library's [release record](https://github.com/jitsi/webrtc/releases/tag/v155.0.1)
identifies the M155 build. Upstream's
[software decoder factory](https://webrtc.googlesource.com/src/+/refs/heads/main/sdk/android/api/org/webrtc/SoftwareVideoDecoderFactory.java)
also routes decoder creation through a native factory. Those sources corroborate
the architecture; the hashes and bytecode inspection above describe the exact
artifact used here.

Successful R8 compilation confirms only that this packaging exception is accepted.
Device tests must still verify peer initialization, data-channel connectivity,
and any video/audio use. Remote agent chat uses WebRTC data channels and does not
require a video decoder.
