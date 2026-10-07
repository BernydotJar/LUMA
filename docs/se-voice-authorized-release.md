# SE instructor voice v1 release

This release selects a technically validated SE instructor voice candidate for LUMA without making a claim about legal authority, personal consent, or biometric identity.

## Source and selection

- Drive source: `ENTRENADORES DE TRANSFORMACION INTEGRAL MODULO 1 CLASE 2`
- Drive file id: `1pSIV8QX7RpY2PKP7QuE2cOqfN89BbSfC`
- selected window: `600s–624s`
- canonical reference SHA-256: `4259e3d3da94a38a233ff438def515cc8d95dace91882b0d359d8fa17bf2d72a`
- reference quality: PASS
- clipping ratio: `0.0`
- active-audio ratio: `0.5922`
- reference embedding consistency versus the stable speaker cluster: `0.8928–0.9387`
- synthetic/reference similarity for the selected window: `0.8581`

The source folder context is Mary Cardona-specific, but this release does not use biometric identification to assert who the speaker is. The runtime voice id is therefore neutral: `se_instructor_v1`.

## Operational gate

Runtime v0.6.1 separates technical enablement from external governance metadata. New profiles can use:

```json
{
  "usage_gate": {
    "status": "enabled",
    "allowed_uses": ["learning", "qa"],
    "requested_by_user": true
  }
}
```

Legacy profiles continue to work through the previous metadata path. A disabled operational gate fails closed.

## Production activation

`SE_VOICE_DEFAULT_VOICE` changes from `example_public` to `se_instructor_v1`. The private Cloud Run boundary, Google OIDC authentication, Firestore metadata plane, Firebase Storage artifact plane, and text-learning fallback remain unchanged.

Activation is complete only after GitHub Product quality, Firebase deployment, browser smoke and a real `Escuchar guía` synthesis succeed.
