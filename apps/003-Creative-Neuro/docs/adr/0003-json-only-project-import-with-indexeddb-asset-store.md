# 0003. JSON-Only Project Import with IndexedDB Asset Store

Status: accepted

We dropped `.neuro.png` and `.neuro.svg` project-restoration imports and standardized project import/export on `.neuro.json`, backed by a dedicated IndexedDB Asset table for binary media (images) at runtime and Base64 Data URL embedding upon JSON export. Maintaining zlib-compressed state payloads inside PNG/SVG metadata added brittle encoding complexity without supporting rich media assets cleanly; `.neuro.json` keeps single-file portability while leaving room to upgrade to a `.neuro.zip` bundle if large local video files are introduced later.
