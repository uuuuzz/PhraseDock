# Validation

Current development baseline: macOS on Apple Silicon. Windows and Intel Mac are not yet validated.

## Automated checks

- JavaScript syntax checks pass.
- Eight Node tests cover configuration validation, Unicode preservation, radial layouts for 1–12 phrases, display-edge clamping, and migration of saved window positions.
- The Swift macOS bridge compiles successfully.
- The packaged macOS application passes `codesign --verify --deep --strict`.

## macOS runtime checks

- Collapsed mode displays only the central `+` button and keeps hidden phrases inert.
- Expanding and collapsing the radial menu works through real UI clicks.
- Six keycap buttons render without overlap; the central right-click utility menu opens correctly.
- The accessibility bridge recognizes an editable text area, inserts at the current selection, verifies the resulting text, and restores the clipboard in the local input fixture.
- The floating panel does not submit text automatically.

## Signing continuity

Development builds use a dedicated local certificate and a designated requirement bound to both `com.phrasedock.desktop` and that certificate. A modified test build produced a different cdhash while preserving the same designated requirement, passed the earlier requirement check, and retained the existing macOS Accessibility authorization.

The private key remains in the developer's login keychain. No private key, PKCS#12 bundle, certificate export, or environment secret is stored in this repository. This local identity is not a Developer ID and is not suitable for public Gatekeeper distribution or Apple notarization.

## Remaining release validation

- Implement and test the Windows UI Automation and input adapter.
- Build or test Intel/universal macOS output if it will be advertised.
- Use Developer ID signing and notarization for a public macOS binary.
- Package versioned release assets and publish SHA-256 checksums.
