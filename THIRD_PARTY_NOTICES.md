# Third-party notices and source lineage

Mines Mobile derives from the Mines desktop repository at commit
`3de42d577a1e744b465c4893254a1ca5dbe0fb67`. That repository identifies T3 Code
commit `375da0fb9a20dfdbd2eb2db99050341fc30f3a23` as its upstream base.
The original MIT license, Copyright (c) 2026 T3 Tools Inc., is retained in
[LICENSE](LICENSE). Compatibility package names such as `@t3tools` do not imply
affiliation with upstream.

The build generates the app's dependency notices from
[third-party-licenses.config.json](third-party-licenses.config.json), installed
package metadata and bundled license files. This document records the inherited
native and forked sources; it does not replace their full license texts or certify
all future dependency versions.

## Bundled React Native forks

The local archives in `apps/mobile/deps` are required dependencies, rather than
interchangeable registry releases. Their `LICENSE` and `t3-fork.json` records are
preserved inside the archives.

| Archive | License and copyright | Recorded source commit | Recorded upstream base |
| --- | --- | --- | --- |
| `react-native-enriched-markdown-1.2.0-t3.16-8d2f84a8.tgz` | MIT; Software Mansion, 2025 | `8d2f84a81c95c020523acc6a24f70b209cde7a0c` | `69c3330dd6d75cacd8d046f4e0c4b8fe5c42a6e1` |
| `react-native-screens-5.0.0-t3.43.tgz` | MIT; Software Mansion, 2018 | `830d18efbff569b28283b67bb03d330cb86f04e7` | `72f38a66c188bdebee7a7798c9b72a121b7a8451` |

Enriched Markdown's lineage record points to
[`pingdotgg/enriched-markdown`](https://github.com/pingdotgg/enriched-markdown);
its package metadata retains the original
`juliusmarminge/enriched-markdown` repository URL. Screens' records point to
[`juliusmarminge/react-native-screens`](https://github.com/juliusmarminge/react-native-screens).
These records describe provenance; the mobile build uses the included archives.

Archive SHA-256 values:

```text
2cbace50e25ac5ba20d839043b5c3e05e90cab36317522d22a9c1e6d8eb95b05  react-native-enriched-markdown-1.2.0-t3.16-8d2f84a8.tgz
043bec3fa36971bc3e99a45d0f8582168008321422934907960435b9c3792a47  react-native-screens-5.0.0-t3.43.tgz
```

Keep the archive references and relevant `pnpm-workspace.yaml` build allowlist
entries together when updating dependencies. Native clients require rebuilding
after native fork changes.

## Native sources and assets

- Ghostty Android terminal libraries and C headers: MIT, Copyright (c) 2024
  Mitchell Hashimoto and Ghostty contributors. Revision
  `9f62873bf195e4d8a762d768a1405a5f2f7b1697`; full license in
  [native/libghostty-vt/LICENSE](native/libghostty-vt/LICENSE).
- GhosttyKit iOS framework: MIT; custom-I/O source revision
  `cf8edc23f3a6a87a96e41a90013e89e987d34980`. Its branch lineage and the Android
  terminal font attribution are retained in
  [the terminal module notices](apps/mobile/modules/mines-terminal/THIRD_PARTY_NOTICES.md).
- Source-text component: derived from Bluesky's `react-native-uitextview` 2.2.0,
  commit `addc08fea303608f070fe1eeba4bc075f181c4af`; MIT, Copyright (c) 2024-25
  Bluesky PBC. See
  [the module attribution](apps/mobile/modules/mines-source-text/UPSTREAM.md) and
  [license](apps/mobile/modules/mines-source-text/LICENSE).
- Composer editor: inherited Expo text-editor implementation; MIT, Copyright (c)
  2015-present 650 Industries, Inc. See
  [the retained license](apps/mobile/modules/mines-composer-editor/LICENSE).
- Highlighting runtime: WABT wasm2c 1.0.42, Apache-2.0, and SIMD Everywhere
  0.8.2, MIT with additional source-level notices. Full vendor sources and
  notices remain under `apps/mobile/modules/mines-highlights/Vendor`.
- MesloLGS NF terminal fonts: Apache-2.0. KaTeX mathematical fonts: OFL-1.1 with
  their reserved font names. Their generated notices remain in the app manifest.

## Packaging metadata corrections

The inherited notice configuration still referenced native module directories
named `t3-source-text`, `t3-composer-editor` and `t3-highlights`. This extraction
updates those paths to their existing `mines-*` names so the same license texts
remain available to the notice generator.

The terminal, highlights and review-diff podspecs inherited an `UNLICENSED`
metadata value, while their containing source repository carries the MIT grant
above and the wrapper source files declare no replacement restrictive license.
Their podspec metadata now names MIT and points to a module-local copy of the
unchanged root MIT license. This correction does not relicense vendor code or
remove any package-specific notices.
