# SubStellar — Master Agent Directives

Dokumen ini adalah titik masuk utama direktif instruksi bagi AI Agent pada repositori **SubStellar**.
Seluruh instruksi telah dipecah secara modular ke dalam folder spesifik di `.agent/` agar efisien dan mudah diakses.

> **Prinsip Utama:** Proyek ini dikerjakan secara tuntas, presisi, performan tinggi, dan **tidak setengah-setengah**. Setiap modul **wajib ramah terhadap perangkat low-end (hemat RAM, CPU, dan GPU).**

---

## Indeks Direktif Modular

1. **Visi & Identitas:** [.agent/core/identity.md](file:///f:/CODE/software/sub-stellar/.agent/core/identity.md)
2. **Arsitektur & Tech Stack:** [.agent/core/architecture.md](file:///f:/CODE/software/sub-stellar/.agent/core/architecture.md)
3. **Optimasi Hardware Low-End:** [.agent/performance/low-end-guidelines.md](file:///f:/CODE/software/sub-stellar/.agent/performance/low-end-guidelines.md)
4. **Web Worker Audio:** [.agent/performance/audio-workers.md](file:///f:/CODE/software/sub-stellar/.agent/performance/audio-workers.md)
5. **PixiJS v8 & Partikel:** [.agent/engines/pixi-particle.md](file:///f:/CODE/software/sub-stellar/.agent/engines/pixi-particle.md)
6. **Furigana / Ruby Text:** [.agent/engines/furigana-ruby.md](file:///f:/CODE/software/sub-stellar/.agent/engines/furigana-ruby.md)
7. **Tipografi, Unicode & Kustom Font:** [.agent/engines/typography-unicode.md](file:///f:/CODE/software/sub-stellar/.agent/engines/typography-unicode.md)
8. **FFmpeg Export:** [.agent/engines/ffmpeg-pipeline.md](file:///f:/CODE/software/sub-stellar/.agent/engines/ffmpeg-pipeline.md)
9. **Gatefold Theming (OKLCH):** [.agent/ui/gatefold-theme.md](file:///f:/CODE/software/sub-stellar/.agent/ui/gatefold-theme.md)
10. **Gatefold 3-Zone Layout:** [.agent/ui/shell-layout.md](file:///f:/CODE/software/sub-stellar/.agent/ui/shell-layout.md)
11. **Standar No-UI-Slop & UI States:** [.agent/ui/no-ui-slop.md](file:///f:/CODE/software/sub-stellar/.agent/ui/no-ui-slop.md)
12. **YouTube & Lyrics Workflow:** [.agent/workflows/lyrics-youtube.md](file:///f:/CODE/software/sub-stellar/.agent/workflows/lyrics-youtube.md)
13. **Standar Rekayasa & Kualitas Kode:** [.agent/workflows/engineering-standards.md](file:///f:/CODE/software/sub-stellar/.agent/workflows/engineering-standards.md)
14. **Keamanan & Perlindungan Sistem:** [.agent/workflows/security-guidelines.md](file:///f:/CODE/software/sub-stellar/.agent/workflows/security-guidelines.md)
15. **Protokol Verifikasi:** [.agent/workflows/verification-protocol.md](file:///f:/CODE/software/sub-stellar/.agent/workflows/verification-protocol.md)

---

## Status Milestone Implementasi

* **Fase 1 (Inisialisasi Fondasi & Shell Gatefold):** Selesai (`1.0.0-alpha.1`)
* **Fase 2 (Viewport PixiJS v8, RubyLayout Engine & No-Slop UI):** Selesai (`1.0.0-alpha.2`)
* **Fase 3 (Particle Engine dengan Zero-GC Object Pooling):** Selesai (`1.0.0-alpha.3`)
* **Fase 4 (Integrasi YouTube & Multi-Source Lyrics Fetcher):** Selesai (`1.0.0-alpha.4`)
* **Fase 5 (Audio Waveform Worker & Timeline Scrubber):** Selesai (`1.0.0-alpha.5`)
* **Fase 6 (FFmpeg Hardware Auto-Probing & Export Pipeline):** Antrean Berikutnya

---

## Dokumentasi Resmi Proyek
* **Product Requirements Document:** [docs/PRD.md](file:///f:/CODE/software/sub-stellar/docs/PRD.md)
* **Master Plan Arsitektur:** [docs/MASTER_PLAN.md](file:///f:/CODE/software/sub-stellar/docs/MASTER_PLAN.md)
* **Software Architecture & Technical Design:** [docs/ARCHITECTURE.md](file:///f:/CODE/software/sub-stellar/docs/ARCHITECTURE.md)
* **Code Quality & Engineering Practices:** [docs/ENGINEERING_PRACTICES.md](file:///f:/CODE/software/sub-stellar/docs/ENGINEERING_PRACTICES.md)
* **Testing & Quality Assurance Plan:** [docs/TESTING.md](file:///f:/CODE/software/sub-stellar/docs/TESTING.md)
* **Security & Threat Mitigation Plan:** [docs/SECURITY.md](file:///f:/CODE/software/sub-stellar/docs/SECURITY.md)
* **Performance & Optimization Guide:** [docs/PERFORMANCE.md](file:///f:/CODE/software/sub-stellar/docs/PERFORMANCE.md)
* **UI/UX & Accessibility Design Guide:** [docs/UI_UX.md](file:///f:/CODE/software/sub-stellar/docs/UI_UX.md)
* **DevOps, CI/CD & Distribution Strategy:** [docs/DEVOPS.md](file:///f:/CODE/software/sub-stellar/docs/DEVOPS.md)
* **API & IPC Documentation:** [docs/API.md](file:///f:/CODE/software/sub-stellar/docs/API.md)
* **User Manual & Help Center:** [docs/USER_MANUAL.md](file:///f:/CODE/software/sub-stellar/docs/USER_MANUAL.md)
* **Legal, Compliance & Privacy Policy:** [docs/LEGAL_COMPLIANCE.md](file:///f:/CODE/software/sub-stellar/docs/LEGAL_COMPLIANCE.md)
* **Architecture Decision Records (ADR):** [docs/adr/](file:///f:/CODE/software/sub-stellar/docs/adr/)
* **Changelog Proyek:** [CHANGELOG.md](file:///f:/CODE/software/sub-stellar/CHANGELOG.md)
