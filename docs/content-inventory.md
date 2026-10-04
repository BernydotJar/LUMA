# Content Inventory

## Source

Google Drive corpus: `195yeoGJff1kKhaE3DO0f8mPwDKIlfN4z`

Inventory date: 2026-10-04

The Drive hierarchy is treated as ingestion provenance, not as the final learner navigation.

## Top-level corpus

| Collection | Observed contents | Current use |
|---|---|---|
| Module 1 | Nested class folder and support-material folder | Inventoried; deeper recursion pending |
| Module 2 | 5 MP4 classes, 1 PDF | Inventoried |
| Module 3 | 3 MP4 classes, 1 structured PDF, support-books ZIP | Selected vertical slice |
| Module 4 | 5 MP4 classes, support-material ZIP | Inventoried |
| Module 5 | 5 MP4 classes | Inventoried |
| Module 6 | 5 MP4 classes | Inventoried |
| Module 7 | 5 MP4 classes, body-language ZIP, HTML export and supporting folder | Inventoried |
| PNL-LINA | Extra classes, eye-reading material, Module 4/6 subfolders, closing video and authoring remnants | Separate complementary collection; requires curation |

## Selected vertical slice: Module 3

Drive folder: `1nf5HX3oqALvEbFr9qOnpPtSSS5_Ij1sx`

| Asset | Drive ID | Type | Size | Status |
|---|---|---:|---:|---|
| `modullo-3-redescubriendo-y-tranformando-tu-poder.pdf` | `1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V` | PDF | 0.88 MB | Text extracted; source-linked in product |
| `practitioner-modulo-3-clase-1-pm-miercoles.mp4` | `1AcbAiq1yOKJTYtk2hSxQ9Nmxyl8T95hY` | MP4 | 2.45 GB | Manifested; transcription pending |
| `practitioner-modulo-3-clase-2-pm.mp4` | `1H4BNR6z82iHdAX8EpwM9BI1xOKYroqsN` | MP4 | 3.21 GB | Manifested; transcription pending |
| `practitioner-modulo-3-clase-3-pm.mp4` | `1QkvB8BZnF83XeQJB4Xh1C0gfNmfdPfgk` | MP4 | 2.88 GB | Manifested; transcription pending |
| `libros-de-apoyo-20230419.zip` | `1vvh3TOQjRRZNKEV2ykf2-ex-bNbE-wUI` | ZIP | 6.78 MB | Licensing review required before ingestion |

## Extracted Module 3 structure

The PDF table of contents exposes the following candidate concept clusters:

1. Comunicación emocional
   - cómo se gestionan las emociones;
   - pensamiento, emoción, action, and goal relationship;
   - evasion, repression, and management.
2. Pensamientos Automáticos Saboteadores (P.A.S.)
   - automatic and rapid thought patterns;
   - absolute language;
   - links to emotion and behavior;
   - modifiability.
3. Dónde cambiar
   - behavior;
   - internal process;
   - internal state.
4. Niveles lógicos
   - environment;
   - behavior;
   - capabilities;
   - beliefs and values;
   - identity;
   - mission / transpersonal level.
5. Creencias y cambio de creencias
6. Mapas mentales
7. Valores
8. Virus mentales and proposed “antivirus” methods
9. Identidad

## Provenance policy

Every generated learning object must store:

- source asset ID and immutable checksum when materialized;
- original Drive URL;
- page, section, or timestamp range;
- extraction version;
- model and prompt version when AI transformation is involved;
- human approval state;
- confidence and unsupported-claim flags.

The original material is never overwritten.

## Known quality and legal constraints

- The PDF includes claims related to emotion and physical health that require instructional review and, where presented as factual health claims, independent evidence before publication.
- Supporting ZIP files may include third-party books. They remain excluded from ingestion until ownership or permitted educational use is confirmed.
- Video class files are multi-gigabyte assets. Production ingestion needs resumable transfer, media probing, transcription checkpoints, and content-addressed artifacts.
- Folder naming contains spelling and formatting inconsistencies. Canonical IDs—not names—must anchor provenance.
- Corpus inventory is not equivalent to curriculum approval.

## Next ingestion checkpoint

1. Materialize Module 3 PDF into controlled object storage.
2. Compute checksum and page-level extraction manifest.
3. Produce human-reviewable concept candidates.
4. Transcribe one representative video before all three.
5. Align concepts found in video and document.
6. Create source-backed diagnostic and practice objects.
7. Run unsupported-claim and assessment-alignment checks.
