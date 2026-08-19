import { useState, useRef, useEffect, useCallback } from "react";

/* ── palette ── */
const C = {
  bg: "#f6f6f2", panel: "#ffffff", border: "#e2e2da",
  t1: "#1a1a1a", t2: "#555", t3: "#999",
};

/* ── phases: Part 1 = outermost (widest radius) → attrition inward ── */
const PHASES = [
  { label: "Part 1", desc: "mAb Discovery",       hex: "#1D9E75", tip: "Part 1 — mAb Discovery. Outermost coil (widest radius): the largest candidate pool before attrition." },
  { label: "Part 2", desc: "Format Design",       hex: "#7F77DD", tip: "Part 2 — Format Design. NGS, VDJ annotation, and in silico format fitness; the coil narrows as formats are dropped." },
  { label: "Part 3", desc: "Expression & Char.",  hex: "#378ADD", tip: "Part 3 — Expression & Characterization. Expression, purification, and biophysical QC; failed expressors and aggregates drop out." },
  { label: "Part 4", desc: "Protein Engineering", hex: "#BA7517", tip: "Part 4 — Protein Engineering. Affinity, humanization, Fc and developability edits start a new inner attrition cycle." },
  { label: "Part 5", desc: "VHH / BoltzGen",      hex: "#993556", tip: "Part 5 — VHH / BoltzGen. Innermost coil (narrowest radius): AI-designed VHHs and humanized variants." },
];

const DCOL = {
  molbio: "#1D9E75", protein: "#7F77DD", bioinf: "#378ADD",
  assay: "#BA7517", decision: "#D85A30", engineer: "#993556",
  xlink: "#5B8DB8",
};

const THREADS = [
  { id: "seq",   label: "Sequence",         hex: "#E24B4A", nodes: ["n5","n10","n11","n12","n15","n16","n28","n31","n32","n36","n38"], tip: "Sequence thread: cloning, annotation, registration, and variant generation." },
  { id: "cross", label: "Cross-reactivity", hex: "#1D9E75", nodes: ["n7","n8","n14","n21"], tip: "Cross-reactivity thread: ortholog binding and kinetics that support in vivo translation." },
  { id: "dev",   label: "Developability",   hex: "#378ADD", nodes: ["n8","n9","n14","n19","n20","n25","n30"], tip: "Developability thread: stability, aggregation, PTMs, and other CMC-risk gates." },
  { id: "human", label: "Humanization",     hex: "#993556", nodes: ["n24","n33","n34","n35","n36","n38"], tip: "Humanization thread: FR grafting, back-mutations, and VHH FR2 humanization." },
  { id: "luma",  label: "Luma",             hex: "#7F77DD", nodes: ["n1","n2","n6","n10","n12","n15","n17","n22","n28","n30","n37","n38"], tip: "Luma thread: steps that write to or read from the sequence registry." },
  { id: "xlink", label: "Cross-linking",    hex: "#5B8DB8", nodes: ["x1","x2","x3","x4","x5","x6","x7","x8","x9"], tip: "Cross-linking / PTM thread: XL-MS, glycans, disulfides, and conjugation sites." },
];

const DOM_TIP = {
  molbio: "Molecular biology step",
  protein: "Protein design or purification step",
  bioinf: "Bioinformatics / sequence analysis step",
  assay: "Assay or characterization step",
  decision: "Decision gate — candidates advance or drop",
  engineer: "Protein or VHH engineering step",
  xlink: "Cross-linking / PTM node (square marker on the spiral)",
};

const XL_LAYERS = [
  { num: 1, name: "Sequences", desc: "VH, VL chain sequences", color: "#2E7D32", always: true, tip: "Layer 1 is always on. Sequence identity is the base uniqueness key." },
  { num: 2, name: "Disulfide crosslinks", desc: "Optional — default off for IgGs", color: "#F9C200", textColor: "#333", tip: "Canonical IgG disulfides are shared. Leave off so they do not split uniqueness." },
  { num: 3, name: "Other sequence crosslinks", desc: "Non-disulfide XL · ring-forming", color: "#7F77DD", tip: "Non-disulfide sequence crosslinks contribute to uniqueness when enabled." },
  { num: 4, name: "Chemical components", desc: "PTMs, glycosylation, modifications", color: "#1D9E75", tip: "PTMs and glycans distinguish molecules that share sequence." },
  { num: 5, name: "XL to chemical components", desc: "ADC, Lys coupling, bicyclic XL", color: "#D85A30", tip: "Linker and conjugation chemistry. Unknown attachment sites are only partial uniqueness." },
];

const PTM_SITES = [
  { mod: "Disulfide", site: "Cys23–Cys96", layer: "L2", status: "Confirmed", tip: "Canonical VH intra-chain disulfide. Confirmed by mapping; uniqueness off by default." },
  { mod: "N-glycosylation", site: "Asn297 / Asn317", layer: "L4", status: "Confirmed", tip: "Fc N-glycan required for FcγR engagement. Glycoform affects ADCC and clearance." },
  { mod: "Oxidation", site: "Met255 / Met431", layer: "L4", status: "Flagged", tip: "Methionine oxidation can reduce Protein A binding and is a developability flag." },
  { mod: "Deamidation", site: "CDR NG / NS", layer: "L4", status: "Predicted", tip: "Asn deamidation in CDRs can shift charge and affinity — scan before nomination." },
  { mod: "Lys ADC coupling", site: "Lys unspecified", layer: "L5", status: "Unknown site", tip: "Stochastic Lys conjugation: DAR mixture until the attachment site is resolved." },
];

const THRESH_PRESETS = {
  screening: {
    kdG: 100, kdY: 500, blockG: 50, blockY: 30, macG: 10, macY: 20,
    hlG: 10, hlY: 5, secG: 80, secY: 70, aggG: 20, aggY: 40, titerG: 0.05, titerY: 0.01,
  },
  lead: {
    kdG: 2, kdY: 10, blockG: 80, blockY: 65, macG: 2, macY: 4,
    hlG: 30, hlY: 10, secG: 90, secY: 80, aggG: 10, aggY: 20, titerG: 0.7, titerY: 0.3,
  },
  candidate: {
    kdG: 1, kdY: 5, blockG: 85, blockY: 75, macG: 1.5, macY: 3,
    hlG: 40, hlY: 20, secG: 95, secY: 90, aggG: 5, aggY: 10, titerG: 1.0, titerY: 0.5,
  },
};

const THRESH_METRICS = [
  { key: "kd", label: "hTfR1 KD", unit: "nM", gOp: "≤", yOp: "≤", rOp: ">", gTip: "Green: preferred affinity for this stage." },
  { key: "block", label: "% Blockade", unit: "%", gOp: "≥", yOp: "≥", rOp: "<", gTip: "Green: functional blockade of transferrin uptake." },
  { key: "mac", label: "Mac/Hu KD ratio", unit: "×", gOp: "≤", yOp: "≤", rOp: ">", gTip: "Green: macaque vs human affinity close enough for in vivo models." },
  { key: "hl", label: "t½", unit: "min", gOp: "≥", yOp: "≥", rOp: "<", gTip: "Green: receptor engagement half-life in the preferred range." },
  { key: "sec", label: "SEC % purity", unit: "%", gOp: "≥", yOp: "≥", rOp: "<", gTip: "Green: monomer purity at or above the stage target." },
  { key: "agg", label: "% Aggregation", unit: "%", gOp: "<", yOp: "<", rOp: "≥", gTip: "Green: aggregation below the stage cutoff." },
  { key: "titer", label: "Titer", unit: "g/L", gOp: "≥", yOp: "≥", rOp: "<", gTip: "Green: expression titer sufficient to advance." },
];

const REG_LINKS = [
  { label: "Luma sequence registry", url: "https://dotmatics.com/products/luma", col: "#7F77DD", tip: "Open Luma to register sequences and uniqueness keys for this program." },
  { label: "UniProt entry", url: "https://www.uniprot.org/uniprot/P02786", col: "#1D9E75", tip: "Human transferrin receptor (P02786) — the primary antigen record." },
  { label: "GenBank nucleotide", url: "https://www.ncbi.nlm.nih.gov/nuccore/", col: "#378ADD", tip: "Search GenBank for nucleotide records linked to cloned VH/VL genes." },
  { label: "Reactome browser", url: "https://reactome.org/PathwayBrowser/", col: "#BA7517", tip: "Open Reactome to inspect TfR trafficking and related pathways." },
  { label: "PDB structure search", url: "https://www.rcsb.org/", col: "#5B8DB8", tip: "Search RCSB PDB for TfR and antibody complex structures used in docking." },
];

/* Part 1 = largest radius (index 0 → outermost), Part 5 = smallest */
const SP_RADII = [230, 185, 140, 100, 65];

const NODES = [
  /* Part 1 — mAb Discovery */
  { id: "n1", ph: 0, t: .05, label: "Reagent prep",        sub: "Soluble TfR proteins",         dom: "molbio",   gate: ">95% purity",         tools: ["Luma"], up: ["P02786","Q62351"], re: ["R-HSA-917977"], loop: null,
    detail: "Prepare soluble TfR proteins for human (P02786), mouse (Q62351), macaque (F6UX47). Confirm purity by analytical SEC. Typically 10,000+ starting molecules at this stage.", assay: "Analytical SEC, protein QC" },
  { id: "n2", ph: 0, t: .14, label: "Cell line dev",       sub: "TfR expression / FACS",        dom: "molbio",   gate: ">95% viability",      tools: ["Luma"], up: ["P02786"], re: ["R-HSA-432722"], loop: null,
    detail: "Transfect cell lines and validate TfR surface expression by FACS.", assay: "FACS" },
  { id: "n3", ph: 0, t: .23, label: "Immunization",        sub: "Prime, boost, titer",          dom: "assay",    gate: "Titer 1:10,000+",     tools: ["Luma"], up: ["P02786"], re: ["R-HSA-202403"], loop: "Re-boost if titer insufficient",
    detail: "Prime mice with hTfR1 + adjuvant. 2-3 boosts. ELISA titer against human, mouse, macaque TfR. Produces diverse polyclonal response.", assay: "ELISA titer panel" },
  { id: "n4", ph: 0, t: .32, label: "B-cell isolation",    sub: "FACS antigen sort",            dom: "assay",    gate: "1,000+ B-cells",      tools: ["Luma"], up: [], re: [], loop: null,
    detail: "Harvest spleens/lymph nodes. Label with biotinylated TfR probe, CD19+, viability dye. FACS sort into 96-well plates. 500-5,000 cells per mouse.", assay: "FACS single-cell sort" },
  { id: "n5", ph: 0, t: .41, label: "VH/VL cloning",       sub: "RT-PCR to expression vector",  dom: "molbio",   gate: "Octet 0.05-0.2 g/L",  tools: ["Luma"], up: [], re: [], loop: null,
    detail: "RT-PCR of VH/VL genes from B-cell plates. Shotgun clone into CHO/HEK293 vectors. Attrition begins: only expressing clones advance.", assay: "Octet BLI" },
  { id: "n6", ph: 0, t: .50, label: "Primary screen",      sub: "ELISA OD > 1 = hit",           dom: "assay",    gate: "OD > 1.0 vs hTfR",    tools: ["Luma"], up: ["P02786"], re: [], loop: null,
    detail: "Plate-based ELISA using bound hTfR. Major attrition event: typically 20-40% of clones advance. Triage from 5 plates to 4.", assay: "Plate ELISA" },
  { id: "n7", ph: 0, t: .59, label: "Cross-reactivity",    sub: "Macaque + mouse panel",        dom: "assay",    gate: "OD > 0.7 macaque",    tools: ["Luma"], up: ["P02786"], re: [], loop: null,
    detail: "Ortholog ELISA panel against rhesus macaque and mouse TfR. Further attrition: only cross-reactive clones useful for in vivo translation.", assay: "Ortholog ELISA" },
  { id: "n8", ph: 0, t: .68, label: "SPR kinetics",        sub: "KD < 100 nM priority",         dom: "assay",    gate: "KD < 100 nM",         tools: ["Luma"], up: ["P02786"], re: [], loop: null,
    detail: "SPR with crude lysates. Measure kon/koff/KD. Significant attrition: only tight binders advance. Prioritize KD < 10 nM.", assay: "SPR" },
  { id: "n9", ph: 0, t: .77, label: "Functional validation", sub: "Block transferrin uptake",   dom: "assay",    gate: ">50% blockade",       tools: ["Luma"], up: ["P02786"], re: ["R-HSA-917977"], loop: null,
    detail: "Alexa488-holo-transferrin uptake assay. Final major attrition in Part 1: only functional blockers advance.", assay: "Flow cytometry" },
  { id: "n10", ph: 0, t: .88, label: "Candidate decision", sub: "Dashboard filter & advance",   dom: "decision", gate: "Multi-criteria pass", tools: ["Luma","Bioglyph"], up: [], re: [], loop: null,
    detail: "Multi-criteria dashboard filter. Typically 10-50 leads advance from thousands of starting molecules — the full attrition funnel is now visible.", assay: "Luma dashboard" },

  /* Part 2 — Format Design */
  { id: "n11", ph: 1, t: .08, label: "NGS library prep",   sub: "Illumina dual-index",           dom: "molbio",   gate: "Library QC pass",     tools: ["Luma","Geneious Bio"], up: [], re: [], loop: null,
    detail: "Illumina dual-index library prep from selected leads. Qubit quantification, Bioanalyzer QC.", assay: "Qubit, Bioanalyzer" },
  { id: "n12", ph: 1, t: .26, label: "VDJ annotation",     sub: "IMGT/IgBLAST in Geneious",      dom: "bioinf",   gate: "Productive only",     tools: ["Geneious Bio","Luma"], up: [], re: [], loop: null,
    detail: "V(D)J annotation: V/J genes, CDR1/2/3, SHM frequency, clonotype grouping at 90%+ CDR3 identity.", assay: "Geneious Biologics" },
  { id: "n13", ph: 1, t: .44, label: "Format design",      sub: "BioGlyph design pad",           dom: "protein",  gate: null,                  tools: ["Bioglyph","Luma"], up: ["Q08752","Q92743"], re: ["R-HSA-1643685"], loop: null,
    detail: "Import CyP40 (Q08752) and HTRA1 (Q92743) into Bioglyph. Design mAb, one-arm, Fab-scFv-Fc formats with enzyme fusions.", assay: "Bioglyph design pad" },
  { id: "n14", ph: 1, t: .62, label: "In silico fitness",  sub: "Stability, agg, immunogenicity", dom: "bioinf",  gate: "Remove format 4b",    tools: ["Bioglyph","Luma"], up: [], re: [], loop: null,
    detail: "Assess stability, aggregation, pairing compatibility, steric clashes, immunogenicity. Remove format 4b. Further attrition of format space.", assay: "In silico developability" },
  { id: "n15", ph: 1, t: .82, label: "Sequence panel",     sub: "Register in Luma",              dom: "decision", gate: "Panel locked",        tools: ["Luma","Geneious Bio"], up: [], re: [], loop: null,
    detail: "Curated VH/VL FASTA, CDR3 sequences ready for synthesis. Register all in Luma Protein Designer.", assay: "Luma sequence registry" },

  /* Part 3 — Expression & Characterization */
  { id: "n16", ph: 2, t: .07, label: "Expression cloning", sub: "Codon optimize to vector",     dom: "molbio",   gate: "Sequence confirmed",  tools: ["Luma","Geneious"], up: ["Q92743"], re: [], loop: null,
    detail: "50 VH-IgG1, 35 VL-kappa, 15 VL-lambda codon-optimized for CHO. Gibson cloning into expression vectors.", assay: "Colony PCR, Sanger" },
  { id: "n17", ph: 2, t: .22, label: "CHO expression",     sub: "Stable pool, titer",            dom: "molbio",   gate: "Protein A titer OK",  tools: ["Luma"], up: [], re: [], loop: "No expression: re-transfect",
    detail: "Transfect linearized plasmid into CHO. Select stable pools. Protein A biosensor titer. Failed expressors loop back.", assay: "Protein A biosensor (Octet)" },
  { id: "n18", ph: 2, t: .38, label: "Protein purification", sub: "Protein A then SEC",          dom: "protein",  gate: "Monomer 90%+",        tools: ["Luma"], up: [], re: [], loop: null,
    detail: "Protein A capture, low-pH elute, analytical SEC. Buffer exchange to PBS-G. Aggregated material fails here — attrition by biophysical quality.", assay: "Protein A, SEC" },
  { id: "n19", ph: 2, t: .53, label: "Bulk characterization", sub: "SEC and SDS-PAGE",           dom: "assay",    gate: "CofA approved",       tools: ["Luma"], up: [], re: [], loop: null,
    detail: "Analytical SEC and SDS-PAGE on all bulk materials. Compile Certificate of Analysis.", assay: "SEC, SDS-PAGE" },
  { id: "n20", ph: 2, t: .67, label: "Mass spec",          sub: "Intact mass LC-MS",             dom: "assay",    gate: "Mass confirmed",      tools: ["Luma"], up: [], re: [], loop: null,
    detail: "Intact mass by LC-MS. Confirm molecular mass, glycosylation, processing artifacts. PTM profiling — unexpected modifications cause attrition.", assay: "LC-MS intact mass" },
  { id: "n21", ph: 2, t: .80, label: "SPR purified",       sub: "Compare to crude KD",           dom: "assay",    gate: "KD matches crude",    tools: ["Luma"], up: ["P02786"], re: [], loop: null,
    detail: "Confirm binding kinetics on purified Ab by SPR. Candidates that lose affinity after purification are eliminated.", assay: "SPR purified Ab" },
  { id: "n22", ph: 2, t: .92, label: "Final selection",    sub: "Potency and developability",    dom: "decision", gate: "Clinical candidate",  tools: ["Luma","Bioglyph"], up: [], re: [], loop: null,
    detail: "Integrate SPR, SEC purity, intact mass, developability. Clinical candidate nomination — typically 1-5 candidates from original thousands.", assay: "Integrated Luma dashboard" },

  /* Part 4 — Protein Engineering */
  { id: "n23", ph: 3, t: .06, label: "Affinity maturation", sub: "CDR saturation mutagenesis",  dom: "engineer", gate: "Improved KD vs parent", tools: ["Geneious Prime","Luma"], up: [], re: [], loop: null,
    detail: "Site-saturation mutagenesis at CDR hotspots. CDR2 Lys58 to Arg58 in HC is a known affinity enhancer. New attrition cycle begins within engineering.", assay: "Geneious Prime mutate and shuffle" },
  { id: "n24", ph: 3, t: .19, label: "Humanization",       sub: "FR grafting, back-mutations",  dom: "engineer", gate: "Human identity maximized", tools: ["Geneious Prime","Luma"], up: [], re: [], loop: null,
    detail: "Convert non-human FRs to human germline IGHV3-23. Back-mutations to restore binding where humanization destabilizes.", assay: "Sequence alignment, SPR" },
  { id: "n25", ph: 3, t: .32, label: "Developability eng.", sub: "Liabilities to point mutations", dom: "engineer", gate: "Liability-free sequence", tools: ["Geneious Prime","Bioglyph","Luma"], up: [], re: [], loop: null,
    detail: "Resolve deamidation, glycosylation, aggregation-prone regions, unpaired cysteines. Each resolved liability is an attrition gate passed.", assay: "In silico liability scan" },
  { id: "n26", ph: 3, t: .45, label: "Fc engineering",     sub: "YTE mutations, extended t1/2", dom: "engineer", gate: "4x half-life predicted", tools: ["Geneious Prime","Luma"], up: [], re: ["R-HSA-2029481"], loop: null,
    detail: "Introduce M252Y S254T T256E (YTE) in CH2-CH3 for approximately 4x half-life via enhanced FcRn binding.", assay: "FcRn SPR, PK modeling" },
  { id: "n27", ph: 3, t: .57, label: "Silent mutations",   sub: "Restriction sites, codon opt", dom: "engineer", gate: "No AA change",        tools: ["Geneious Prime"], up: [], re: [], loop: null,
    detail: "Introduce silent mutations for restriction sites. Codon-optimize for CHO, E. coli, or yeast.", assay: "Geneious Prime silent mutation tool" },
  { id: "n28", ph: 3, t: .70, label: "Variant generation", sub: "Register parent and mutants",  dom: "engineer", gate: "Mutation log complete", tools: ["Geneious Prime","Luma"], up: [], re: [], loop: null,
    detail: "Systematic point mutations with annotated CDR3, V/J assignments, rationale. Register all variants in Luma.", assay: "Geneious Prime, Luma diff" },
  { id: "n29", ph: 3, t: .81, label: "Cloning and expression", sub: "Golden Gate construct",     dom: "molbio",   gate: "Expression confirmed", tools: ["Geneious Prime","Luma"], up: [], re: [], loop: null,
    detail: "Golden Gate or Gibson Assembly with codon-optimized sequences. Circular backbone vectors.", assay: "Colony PCR, Sanger, Octet" },
  { id: "n30", ph: 3, t: .92, label: "Engineering decision", sub: "Variant QC and advance",      dom: "decision", gate: "Lead variant nominated", tools: ["Luma","Bioglyph"], up: [], re: [], loop: null,
    detail: "Integrate SPR, developability, expression titer, mutation log. Nominate lead variant from engineering cycle.", assay: "Luma diff dashboard" },

  /* Part 5 — VHH / BoltzGen */
  { id: "n31", ph: 4, t: .06, label: "BoltzGen design",    sub: "10,000 VHH designs",           dom: "engineer", gate: "Top 20-50 exported",  tools: ["BoltzGen","Luma"], up: ["P02786"], re: [], loop: null,
    detail: "BoltzGen VHH modality, budget=100. Generate 10,000 designs against hTfR. Export top 20-50 VHH sequences. AI-driven pre-attrition narrows design space.", assay: "BoltzGen in silico design" },
  { id: "n32", ph: 4, t: .19, label: "VHH annotation",     sub: "CDR, FR, hallmark residues",   dom: "bioinf",   gate: "Hallmarks identified", tools: ["Geneious Bio","Luma"], up: [], re: [], loop: null,
    detail: "Import VHHs into Geneious Biologics. VHH-specific annotation: CDRs, FRs, hallmark residues at FR2 positions 42, 49, 50, 52.", assay: "Geneious Biologics VHH annotation" },
  { id: "n33", ph: 4, t: .32, label: "FR2 humanization",   sub: "Compare to VH3 germline",       dom: "bioinf",   gate: "Non-human FR flagged", tools: ["Geneious Bio"], up: [], re: [], loop: null,
    detail: "Multiple alignment of VHHs vs IGHV3-23. Identify non-human FR residues. Focus on FR2.", assay: "Multiple sequence alignment" },
  { id: "n34", ph: 4, t: .45, label: "Mutation design",    sub: "Workflow Builder pipeline",     dom: "engineer", gate: "FR mutated, CDRs intact", tools: ["Geneious Prime","Geneious Bio"], up: [], re: [], loop: null,
    detail: "Automated humanization pipeline in Geneious Prime Workflow Builder. Preserve hallmark residues, CDR integrity.", assay: "Geneious Prime Workflow Builder" },
  { id: "n35", ph: 4, t: .57, label: "Structural assessment", sub: "Back-mutation analysis",     dom: "protein",  gate: "Destabilizing back-mutated", tools: ["Bioglyph","Geneious Prime"], up: [], re: [], loop: "Destabilizing mutations: redesign",
    detail: "Bioglyph / Geneious Prime visualization to assess back-mutation impact on VHH stability.", assay: "Molecular visualization" },
  { id: "n36", ph: 4, t: .70, label: "Variant generation VHH", sub: "Humanization levels 1-3",  dom: "engineer", gate: "VH3 identity maximized", tools: ["Geneious Prime","Luma"], up: [], re: [], loop: null,
    detail: "Generate VHH variants with increasing human residue incorporation. CDR-grafted, partially and fully humanized scaffolds.", assay: "Sequence editing, Geneious Prime" },
  { id: "n37", ph: 4, t: .82, label: "VHH cloning",        sub: "Golden Gate + codon opt",       dom: "molbio",   gate: "Expression confirmed", tools: ["Geneious Prime","Luma"], up: [], re: [], loop: null,
    detail: "Expression vectors with codon-optimized VHH sequences. Golden Gate or Gibson. Save workflow via Adaptive Workflows.", assay: "Colony PCR, Sanger, Octet" },
  { id: "n38", ph: 4, t: .93, label: "Diff report",        sub: "Luma diff dashboard",           dom: "decision", gate: "Humanized variant selected", tools: ["Luma","Bioglyph"], up: [], re: [], loop: null,
    detail: "Final QC by Geneious Biologics sequence repair. Luma diff dashboard: original BoltzGen vs each humanized variant.", assay: "Sanger, SPR, Luma diff dashboard" },

  /* ── Cross-linking nodes ── */
  { id: "x1", ph: 0, t: .96, label: "XL-MS overview",       sub: "Structural proteomics by cross-linking", dom: "xlink", gate: null, tools: ["LC-MS"], up: [], re: ["R-HSA-597592"], loop: null,
    detail: "Cross-linking mass spectrometry (XL-MS) captures spatial proximity constraints (< 30 Å for NHS-ester reagents) between lysine residues across protein surfaces. In antibody discovery, XL-MS defines the epitope-paratope contact topology, quaternary arrangement of bispecific arms, and drug-linker attachment sites on ADCs.",
    assay: "LC-MS, XL-MS" },
  { id: "x2", ph: 1, t: .96, label: "XL reagent chemistry", sub: "NHS, DSSO, DSBU, photo-XL", dom: "xlink", gate: null, tools: ["LC-MS"], up: [], re: [], loop: null,
    detail: "NHS-ester reagents (BS3, DTSSP) bridge primary amines on Lys, N-terminus (spacer 11-12 Å). Cleavable reagents (DSSO, DSBU) generate diagnostic MS2 fragments enabling confident XL-peptide identification. Photo-reactive diazirines (SDA, BMOE) allow zero-length or very short cross-links to capture transient or tight interfaces. Reagent choice dictates which surface residues are sampled and the computational distance restraints applied.",
    assay: "NHS-ester XL, DSSO/DSBU cleavable XL, photo-XL" },
  { id: "x3", ph: 2, t: .96, label: "Epitope mapping by XL", sub: "Paratope-antigen distance restraints", dom: "xlink", gate: null, tools: ["LC-MS","Geneious Bio"], up: ["P02786"], re: [], loop: null,
    detail: "hTfR1 is reacted with anti-TfR Ab in presence of NHS-ester cross-linker. Tryptic digestion and LC-MS/MS identify inter-protein cross-linked peptides between Ab CDRs and TfR1 surface loops. Identified pairs provide Cα–Cα distance restraints (≤ 30 Å) used to dock the Ab onto the TfR1 structure (PDB 1CX8) and validate or refine homology model of the paratope.",
    assay: "XL-MS, PDB docking, restraint-guided modelling" },
  { id: "x4", ph: 3, t: .96, label: "PTM characterization", sub: "Glycosylation, deamidation, oxidation", dom: "xlink", gate: null, tools: ["LC-MS"], up: [], re: ["R-HSA-597592"], loop: null,
    detail: "Post-translational modifications (PTMs) on therapeutic antibodies include: N-linked glycosylation at Asn297 (IgG1 Fc CH2) affecting FcγR binding and half-life; C-terminal Lys clipping; Met255/Met431 oxidation reducing Protein A binding; Asn deamidation in CDRs (NG, NS motifs) altering charge and affinity; pyroglutamate cyclization at N-terminal Gln. Each PTM is quantified by peptide mapping LC-MS/MS and has defined developability implications.",
    assay: "Peptide mapping LC-MS/MS, intact mass" },
  { id: "x5", ph: 4, t: .96, label: "Uniqueness & PTM sites", sub: "Site-specific XL on unique residues", dom: "xlink", gate: null, tools: ["LC-MS","Geneious Prime"], up: [], re: [], loop: null,
    detail: "Unique surface Lys and Cys residues are catalogued per Ab variant. Site-specific conjugation exploits engineered unique Cys (THIOMAB technology) or non-natural amino acids for ADC linker attachment with defined DAR. XL-MS confirms site occupancy and verifies no unintended cross-reactivity to paratope Lys residues that would compromise antigen binding after conjugation.",
    assay: "XL-MS, site-specific conjugation analysis" },
  { id: "x6", ph: 0, t: .02, label: "Atomic XL model",      sub: "Residue-level proximity at Angstrom scale", dom: "xlink", gate: null, tools: ["LC-MS"], up: [], re: [], loop: null,
    detail: "At atomic resolution, NHS cross-links span Cα–Cα distances of 24–30 Å (BS3 spacer 11.4 Å + lysine side chain + conformational flexibility). DSSO yields characteristic fragment ions at m/z offsets of 54 and 85 Da from peptide backbone. Zero-length EDC/sulfo-NHS cross-links (< 12 Å) capture salt bridges and very tight electrostatic contacts. Computational modelling integrates distance restraints into Rosetta or HADDOCK docking protocols.",
    assay: "High-resolution XL-MS, Rosetta/HADDOCK docking" },
  { id: "x7", ph: 1, t: .02, label: "Disulfide bond mapping", sub: "Intra/inter-chain SS bonds", dom: "xlink", gate: null, tools: ["LC-MS"], up: [], re: [], loop: null,
    detail: "Canonical IgG1 disulfide bonds: VH–VL (Cys23–Cys88), CH1–CL (Cys134–Cys194), hinge (Cys226–Cys229, Cys229–Cys232), and two Fc inter-chain bonds. Non-canonical disulfide bonds occur in VHH CDR3 loops and engineered THIOMAB constructs. Disulfide mapping by non-reducing peptide mapping and ETD fragmentation identifies free thiols indicating incomplete folding — a key developability and attrition signal.",
    assay: "Non-reducing peptide mapping, ETD-MS" },
  { id: "x8", ph: 2, t: .02, label: "Glycan profiling",     sub: "N-glycan site Asn297 and beyond", dom: "xlink", gate: null, tools: ["LC-MS"], up: [], re: ["R-HSA-597592"], loop: null,
    detail: "IgG1 Fc N-glycosylation at Asn297 is obligatory for FcγR engagement and ADCC. Glycoform composition (G0F, G1F, G2F, afucosylated, sialylated) is quantified by intact glycopeptide LC-MS. High mannose forms (Man5-9) increase serum clearance. Site-specific glycosylation in CDRs (aberrant Asn-X-Ser/Thr motifs introduced by SHM) can occlude antigen binding — a direct attrition signal requiring sequence engineering.",
    assay: "Glycopeptide LC-MS, PNGaseF release and HILIC" },
  { id: "x9", ph: 3, t: .02, label: "Conjugation sites",    sub: "ADC linker & site-specific chemistry", dom: "xlink", gate: null, tools: ["LC-MS","Geneious Prime"], up: [], re: [], loop: null,
    detail: "ADC payload-linker attachment exploits three chemistries: (1) stochastic inter-chain Cys after reduction (DAR 0-8 mixture); (2) engineered unique Cys for site-specific DAR2 or DAR4; (3) non-natural amino acid incorporation (p-AcPhe) for oxime ligation. XL-MS confirms attachment site, drug-to-antibody ratio (DAR) by intact mass, and absence of paratope modification. PTM context (oxidation near conjugation site) directly affects DAR homogeneity and therefore potency and PK.",
    assay: "Intact mass, HIC-MS, XL-MS site verification" },
];

/* ── helix geometry: phase 0 outermost, phase 4 innermost ── */
function helixXYZ(ph, t) {
  const r = SP_RADII[ph];
  const yBase = (ph - 2) * 55;
  const a = t * Math.PI * 2;
  return { x: r * Math.cos(a), y: yBase + (t - 0.5) * 50, z: r * Math.sin(a) };
}

/* ── simple 3D projection (spherical orbit) ── */
function project(pt, theta, phi, fov, cx, cy) {
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const cosP = Math.cos(phi),   sinP = Math.sin(phi);
  const x1 = pt.x * cosT - pt.z * sinT;
  const z1 = pt.x * sinT + pt.z * cosT;
  const y1 = pt.y * cosP - z1 * sinP;
  const z2 = pt.y * sinP + z1 * cosP;
  const scale = fov / (fov + z2);
  return { sx: cx + x1 * scale, sy: cy + y1 * scale, depth: z2 };
}

function BandRow({ metric, thresh, setThresh, tp }) {
  const gKey = metric.key + "G";
  const yKey = metric.key + "Y";
  return (
    <div className="tconf-row" {...tp(metric.gTip)}>
      <div className="tconf-metric">{metric.label}</div>
      <div className="tconf-unit">{metric.unit}</div>
      <div className="tconf-band">
        <label className="g" {...tp("Green band — pass / preferred")}>G</label>
        {metric.gOp}
        <input type="number" step="any" value={thresh[gKey]}
          onChange={e => setThresh(t => ({ ...t, [gKey]: parseFloat(e.target.value) }))}
          {...tp(`Green cutoff (${metric.gOp})`)} />
        <label className="a" {...tp("Yellow band — watch / marginal")}>Y</label>
        {metric.yOp}
        <input type="number" step="any" value={thresh[yKey]}
          onChange={e => setThresh(t => ({ ...t, [yKey]: parseFloat(e.target.value) }))}
          {...tp(`Yellow cutoff (${metric.yOp})`)} />
        <label className="r" {...tp("Red band — fail / do not advance")}>R</label>
        {metric.rOp}{thresh[yKey]}
      </div>
    </div>
  );
}

export default function App() {
  const [selNode, setSelNode] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [activePhase, setActivePhase] = useState(null);
  const [theta, setTheta] = useState(0.3);
  const [phi, setPhi] = useState(0.4);
  const [zoom, setZoom] = useState(1);
  const [panXY, setPanXY] = useState({ x: 0, y: 0 });
  const [laneOpen, setLaneOpen] = useState({ 0: true, 1: false, 2: false, 3: false, 4: false });
  const [tab, setTab] = useState("detail");
  const [dbRecs, setDbRecs] = useState([]);
  const [dbLoad, setDbLoad] = useState(false);
  const [sq, setSq] = useState("");
  const [searching, setSearching] = useState(false);
  const [srRes, setSrRes] = useState([]);
  const [leftW, setLeftW] = useState(240);
  const [rightW, setRightW] = useState(420);
  const [resizing, setResizing] = useState(null);
  const [tip, setTip] = useState(null);
  const [layers, setLayers] = useState({ 2: false, 3: true, 4: true, 5: true });
  const [stage, setStage] = useState("lead");
  const [thresh, setThresh] = useState({ ...THRESH_PRESETS.lead });
  const svgRef = useRef(null);
  const drag = useRef({ down: false, btn: 0, lx: 0, ly: 0 });
  const dragMoved = useRef(false);
  const resizeRef = useRef(null);

  const FOV = 600;
  const CX = 290, CY = 210;

  /* project all nodes */
  const projected = NODES.map(nd => {
    const p3 = helixXYZ(nd.ph, nd.t);
    const pr = project({ x: p3.x * zoom, y: p3.y * zoom, z: p3.z * zoom }, theta, phi, FOV, CX + panXY.x, CY + panXY.y);
    return { nd, ...pr };
  }).sort((a, b) => a.depth - b.depth);

  const threadSet = activeThread ? new Set(THREADS.find(t => t.id === activeThread).nodes) : null;
  const isDim = nd => (activePhase !== null && nd.ph !== activePhase) || (threadSet && !threadSet.has(nd.id));

  /* pointer handlers (orbit / pan) */
  const onPD = e => { drag.current = { down: true, btn: e.button, lx: e.clientX, ly: e.clientY }; };
  const onPM = e => {
    if (!drag.current.down) return;
    const dx = e.clientX - drag.current.lx, dy = e.clientY - drag.current.ly;
    drag.current.lx = e.clientX; drag.current.ly = e.clientY;
    if (drag.current.btn === 2 || e.shiftKey) {
      setPanXY(p => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      setTheta(t => t - dx * 0.005);
      setPhi(p => Math.max(-1.4, Math.min(1.4, p + dy * 0.005)));
    }
  };
  const onPU = () => { drag.current.down = false; };

  /* drag-vs-click discrimination, wraps onPD/onPM */
  const onPDWrapped = e => { dragMoved.current = false; onPD(e); };
  const onPMWrapped = e => {
    const dx = e.clientX - drag.current.lx, dy = e.clientY - drag.current.ly;
    if (Math.hypot(dx, dy) > 3) dragMoved.current = true;
    onPM(e);
  };

  /* click handling — invisible large hit-target per node, so every node is reliably clickable */
  const handleNodeClick = (nd, e) => {
    e.stopPropagation();
    if (dragMoved.current) return;
    setSelNode(nd);
    setTab("detail");
  };
  const handleBgClick = () => {
    if (!dragMoved.current) setSelNode(null);
  };

  const onWheel = useCallback(e => {
    e.preventDefault();
    setZoom(z => Math.min(4, Math.max(0.3, z * (1 - e.deltaY * 0.001))));
  }, []);
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  useEffect(() => {
    const onMove = (e) => {
      const job = resizeRef.current;
      if (!job) return;
      const dx = e.clientX - job.startX;
      if (job.side === "left") {
        setLeftW(Math.min(460, Math.max(180, job.startW + dx)));
      } else {
        setRightW(Math.min(620, Math.max(260, job.startW - dx)));
      }
    };
    const onUp = () => {
      resizeRef.current = null;
      setResizing(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const startResize = (side, startW) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { side, startX: e.clientX, startW };
    setResizing(side);
  };

  const tp = (text) => !text ? {} : {
    onMouseEnter: (e) => setTip({ text, x: e.clientX + 12, y: e.clientY + 18 }),
    onMouseMove: (e) => setTip(cur => ({ text: cur?.text || text, x: e.clientX + 12, y: e.clientY + 18 })),
    onMouseLeave: () => setTip(null),
  };

  const applyStage = (id) => {
    setStage(id);
    setThresh({ ...THRESH_PRESETS[id] });
  };

  const toggleLayer = (num) => setLayers(prev => ({ ...prev, [num]: !prev[num] }));
  const jumpToUniqueness = () => {
    const nd = NODES.find(n => n.id === "x5");
    if (nd) { setSelNode(nd); setTab("detail"); }
  };

  /* thread lines */
  const threadPaths = THREADS.map(th => {
    const pts = th.nodes.map(id => {
      const nd = NODES.find(n => n.id === id); if (!nd) return null;
      const p3 = helixXYZ(nd.ph, nd.t);
      return project({ x: p3.x * zoom, y: p3.y * zoom, z: p3.z * zoom }, theta, phi, FOV, CX + panXY.x, CY + panXY.y);
    }).filter(Boolean);
    const isActive = activeThread === th.id;
    const DASH = 7, GAP = 4; let segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].sx, ay = pts[i].sy, bx = pts[i + 1].sx, by = pts[i + 1].sy;
      const L = Math.hypot(bx - ax, by - ay); if (L < 1) continue;
      const dx = (bx - ax) / L, dy = (by - ay) / L;
      let w = 0, drawSeg = true;
      while (w < L) {
        const step = Math.min(drawSeg ? DASH : GAP, L - w);
        if (drawSeg) segs.push(`M${(ax + dx * w).toFixed(1)},${(ay + dy * w).toFixed(1)}L${(ax + dx * (w + step)).toFixed(1)},${(ay + dy * (w + step)).toFixed(1)}`);
        w += step; drawSeg = !drawSeg;
      }
    }
    return { th, segs, isActive };
  });

  /* helix tube lines per phase */
  const helixLines = PHASES.map((ph, i) => {
    const pts = [];
    for (let j = 0; j <= 80; j++) {
      const p3 = helixXYZ(i, j / 80);
      const pr = project({ x: p3.x * zoom, y: p3.y * zoom, z: p3.z * zoom }, theta, phi, FOV, CX + panXY.x, CY + panXY.y);
      pts.push(pr);
    }
    return { ph, pts, i };
  });

  /* live database fetch on node selection */
  useEffect(() => {
    if (tab !== "databases" || !selNode) return;
    if (!selNode.up.length && !selNode.re.length) { setDbRecs([]); return; }
    setDbLoad(true); setDbRecs([]);
    const results = []; let pending = selNode.up.length + selNode.re.length;
    const done = rec => { if (rec) results.push(rec); if (--pending <= 0) { setDbRecs([...results]); setDbLoad(false); } };
    selNode.up.forEach(id => {
      fetch("https://rest.uniprot.org/uniprotkb/" + id + ".json").then(r => r.json()).then(d => {
        const fnArr = (d.comments || []).filter(c => c.commentType === "FUNCTION");
        const fn = fnArr[0] && fnArr[0].texts && fnArr[0].texts[0] ? fnArr[0].texts[0].value.slice(0, 200) : "";
        const rname = ((d.proteinDescription || {}).recommendedName || {});
        const name = rname.fullName && rname.fullName.value ? rname.fullName.value : id;
        const org = (d.organism || {}).scientificName || "";
        const gene = d.genes && d.genes[0] && d.genes[0].geneName ? d.genes[0].geneName.value : "";
        done({ type: "uniprot", id, name, org, gene, fn, url: "https://www.uniprot.org/uniprot/" + id });
      }).catch(() => done(null));
    });
    selNode.re.forEach(id => {
      fetch("https://reactome.org/ContentService/data/query/" + id).then(r => r.json()).then(d => {
        const summ = d.summation && d.summation[0] ? d.summation[0].text.replace(/<[^>]+>/g, "").slice(0, 200) : "";
        done({ type: "reactome", id, name: d.displayName || id, cls: d.className || "", summ, url: "https://reactome.org/content/detail/" + id, pbUrl: "https://reactome.org/PathwayBrowser/#/" + id });
      }).catch(() => done(null));
    });
  }, [tab, selNode]);

  /* search bar (UniProt + Reactome) */
  const doSearch = () => {
    if (!sq.trim()) return;
    setSearching(true); setSrRes([]);
    const results = []; let pending = 2;
    const done = () => { if (--pending <= 0) { setSrRes([...results]); setSearching(false); } };
    fetch("https://rest.uniprot.org/uniprotkb/search?query=" + encodeURIComponent(sq) + "&format=json&size=4&fields=id,protein_name,gene_names,organism_name,cc_function")
      .then(r => r.json()).then(ud => {
        (ud.results || []).forEach(x => {
          const fnArr = (x.comments || []).filter(c => c.commentType === "FUNCTION");
          const fn = fnArr[0] && fnArr[0].texts && fnArr[0].texts[0] ? fnArr[0].texts[0].value.slice(0, 100) : "";
          const rname = ((x.proteinDescription || {}).recommendedName || {});
          const name = rname.fullName && rname.fullName.value ? rname.fullName.value : x.primaryAccession;
          results.push({ src: "UniProt", col: "#1D9E75", name, note: fn, url: "https://www.uniprot.org/uniprot/" + x.primaryAccession });
        });
        done();
      }).catch(done);
    fetch("https://reactome.org/ContentService/search/query?query=" + encodeURIComponent(sq) + "&types=Pathway&species=Homo+sapiens&cluster=true")
      .then(r => r.json()).then(rd => {
        const grp = (rd.results && rd.results[0]) || {};
        (grp.entries || []).slice(0, 4).forEach(x => {
          results.push({ src: "Reactome", col: "#7F77DD", name: x.name, note: x.typeName || "Pathway", url: "https://reactome.org/content/detail/" + x.stId });
        });
        done();
      }).catch(done);
  };

  const ph = selNode ? PHASES[selNode.ph] : null;
  const myT = selNode ? THREADS.filter(th => th.nodes.includes(selNode.id)) : [];

  const pill = (label, active, col, onClick, tipText) => (
    <button onClick={onClick} {...tp(tipText)} style={{ fontSize: 13, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
      border: `1px solid ${active ? col : C.border}`, background: active ? col + "20" : "#f5f5f2", color: active ? col : C.t2 }}>
      {label}
    </button>
  );

  const tabBtn = (id, label, tipText) => (
    <button onClick={() => setTab(id)} {...tp(tipText)} style={{ fontSize: 14, padding: "5px 12px", background: "transparent", border: "none",
      borderBottom: tab === id ? `2px solid ${C.t1}` : "2px solid transparent",
      color: tab === id ? C.t1 : C.t3, cursor: "pointer", fontFamily: "inherit" }}>
      {label}
    </button>
  );

  return (
    <>
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.t1, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflow: "hidden", userSelect: resizing ? "none" : "auto", cursor: resizing ? "col-resize" : "default" }}>

      {/* LEFT LANE — vertical workflow-step navigator (Ross Spiral sidebar) */}
      <div style={{ width: leftW, flexShrink: 0, background: C.panel, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 8px 6px", fontSize: 13, fontWeight: 700, color: C.t3, letterSpacing: "0.08em" }}
          {...tp("Browse workflow steps by phase. Click a phase to expand; click a step to open it in the detail pane.")}>
          WORKFLOW STEPS
        </div>
        {PHASES.map((ph, i) => {
          const phNodes = NODES.filter(n => n.ph === i);
          const isOpen = laneOpen[i];
          return (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <div onClick={() => setLaneOpen(o => ({ ...o, [i]: !o[i] }))}
                {...tp(`${ph.tip} Click to ${isOpen ? "collapse" : "expand"} this phase.`)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 8px 4px", cursor: "pointer", userSelect: "none", background: isOpen ? ph.hex + "12" : "transparent" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: ph.hex, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: ph.hex, flex: 1 }}>{ph.label}</span>
                <span style={{ fontSize: 13, color: C.t3, marginRight: 2 }}>{phNodes.length}</span>
                <span style={{ fontSize: 13, color: C.t3 }}>{isOpen ? "▾" : "▸"}</span>
              </div>
              <div style={{ fontSize: 12, color: C.t3, padding: "0 8px 5px 20px" }}>{ph.desc}</div>
              {isOpen && phNodes.map(nd => {
                const isSel = selNode?.id === nd.id;
                const dim = isDim(nd);
                return (
                  <div key={nd.id} onClick={() => { setSelNode(nd); setTab("detail"); }}
                    {...tp(`${nd.label} — ${nd.sub}${nd.gate ? `. Gate: ${nd.gate}` : ""}${nd.loop ? `. Loop: ${nd.loop}` : ""}`)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 18px", cursor: "pointer", opacity: dim ? 0.2 : 1,
                      background: isSel ? DCOL[nd.dom] + "18" : "transparent",
                      borderLeft: isSel ? `2px solid ${DCOL[nd.dom]}` : "2px solid transparent" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: DCOL[nd.dom], flexShrink: 0 }} {...tp(DOM_TIP[nd.dom])} />
                    <span style={{ fontSize: 13, color: isSel ? C.t1 : C.t2, flex: 1, lineHeight: 1.3 }}>{nd.label}</span>
                    {nd.loop && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#D85A30", flexShrink: 0 }} {...tp("This step can loop back if the gate fails.")} />}
                    {(nd.up.length > 0 || nd.re.length > 0) && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#378ADD", flexShrink: 0 }} {...tp("Linked UniProt or Reactome records are available in the Databases tab.")} />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div
        className={`resize-handle${resizing === "left" ? " dragging" : ""}`}
        onPointerDown={startResize("left", leftW)}
        {...tp("Drag to widen or narrow the workflow list.")}
      />

      {/* CENTER — 3D orbit spiral (pure SVG, no Three.js dependency) */}
      <div ref={svgRef} style={{ flex: 1, position: "relative", overflow: "hidden", cursor: drag.current.down ? "grabbing" : "grab", userSelect: "none" }}
        onPointerDown={onPDWrapped} onPointerMove={onPMWrapped} onPointerUp={onPU} onPointerLeave={onPU}
        onContextMenu={e => e.preventDefault()}
        {...tp("Drag to orbit the spiral. Scroll to zoom. Shift-drag to pan. Click a node for details.")}>

        <svg width="100%" height="100%" viewBox="0 0 580 420" style={{ display: "block", background: C.bg }}
          onClick={handleBgClick}>

          {/* Helix tube lines */}
          {helixLines.map(({ ph, pts, i }) => {
            const dim = activePhase !== null && activePhase !== i;
            const d = pts.map((p, j) => j === 0 ? `M${p.sx.toFixed(1)},${p.sy.toFixed(1)}` : `L${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");
            return <path key={i} d={d} fill="none" stroke={ph.hex} strokeWidth={1.8} strokeOpacity={dim ? 0.05 : 0.22}
              strokeDasharray={i === 0 ? "5 4" : i === 4 ? "2 3" : "none"}>
              <title>{ph.label} — {ph.desc}. Coil width reflects remaining candidates.</title>
            </path>;
          })}

          {/* Thread dashed lines */}
          {threadPaths.map(({ th, segs, isActive }) => (
            <path key={th.id} d={segs.join(" ")} fill="none" stroke={th.hex}
              strokeWidth={isActive ? 2 : 1} strokeOpacity={isActive ? 0.9 : activeThread ? 0.07 : 0.22}>
              <title>{th.label} thread — {th.tip}</title>
            </path>
          ))}

          {/* Loop-back arcs */}
          {NODES.filter(n => n.loop).map(nd => {
            const p3 = helixXYZ(nd.ph, nd.t);
            const { sx: x, sy: y } = project({ x: p3.x * zoom, y: p3.y * zoom, z: p3.z * zoom }, theta, phi, FOV, CX + panXY.x, CY + panXY.y);
            return (
              <g key={nd.id + "_lp"}>
                <title>Loop-back: {nd.loop}</title>
                <path d={`M${x},${y} C${x - 18},${y - 22} ${x - 28},${y + 6} ${x - 2},${y + 14}`}
                  fill="none" stroke="#D85A30" strokeWidth={0.9} strokeDasharray="3 3" strokeOpacity={0.6} />
                <circle cx={x - 2} cy={y + 14} r={1.8} fill="#D85A30" fillOpacity={0.6} />
              </g>
            );
          })}

          {/* Nodes — sorted by depth (back to front); each has a large invisible hit target */}
          {projected.map(({ nd, sx, sy, depth }) => {
            const isSel = selNode?.id === nd.id;
            const dim = isDim(nd);
            const col = DCOL[nd.dom];
            const r = isSel ? 7 : Math.max(3.5, 5.5 - depth * 0.003);
            const hasDb = nd.up.length > 0 || nd.re.length > 0;
            return (
              <g key={nd.id} onClick={e => handleNodeClick(nd, e)} style={{ cursor: "pointer" }}
                {...tp(`${nd.label} — ${nd.sub}. ${PHASES[nd.ph].label}. Click to open details.`)}>
                <title>{nd.label} — {nd.sub}</title>
                <circle cx={sx} cy={sy} r={16} fill="transparent" stroke="none" />
                {isSel && <circle cx={sx} cy={sy} r={r + 5} fill="none" stroke={col} strokeWidth={1.2} strokeOpacity={0.3} />}
                <circle cx={sx} cy={sy} r={r} fill={isSel ? col : C.panel} stroke={col} strokeWidth={1.4} opacity={dim ? 0.08 : 1} />
                {hasDb && !dim && <circle cx={sx + r - 1} cy={sy - r + 1} r={1.8} fill="#378ADD" opacity={0.9} />}
                {nd.loop && !dim && <circle cx={sx - r + 1} cy={sy - r + 1} r={1.8} fill="#D85A30" opacity={0.9} />}
                {nd.dom === "xlink" && !dim && <rect x={sx - 3} y={sy - 3} width={6} height={6} rx={1} fill={col} opacity={0.5} />}
                {isSel && <text x={sx + r + 5} y={sy + 5} fontSize={13} fontWeight={600} fill={col} style={{ pointerEvents: "none" }}>{nd.label}</text>}
              </g>
            );
          })}

          <defs>
            <linearGradient id="attrGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#993556" stopOpacity="0.03" />
            </linearGradient>
          </defs>
        </svg>

        {/* Zoom / rotate controls */}
        <div style={{ position: "absolute", bottom: 12, left: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {[["＋", () => setZoom(z => Math.min(4, z * 1.25)), "Zoom in on the spiral"],
            ["⟲", () => { setZoom(1); setTheta(0.3); setPhi(0.4); setPanXY({ x: 0, y: 0 }); }, "Reset orbit, zoom, and pan to the default view"],
            ["－", () => setZoom(z => Math.max(0.3, z / 1.25)), "Zoom out"]
          ].map(([l, fn, tipText]) => (
            <button key={l} onClick={fn} {...tp(tipText)} style={{ width: 32, height: 32, border: `1px solid ${C.border}`, borderRadius: 6, background: C.panel, color: C.t2, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</button>
          ))}
          <div style={{ fontSize: 13, color: C.t3, textAlign: "center" }} {...tp("Current zoom level")}>{Math.round(zoom * 100)}%</div>
        </div>

        <div style={{ position: "absolute", top: 8, left: 8, fontSize: 13, color: C.t3, lineHeight: 1.8, pointerEvents: "none" }}>
          Drag · orbit &nbsp;|&nbsp; Scroll · zoom &nbsp;|&nbsp; Shift-drag · pan &nbsp;|&nbsp; Right-click · menu off
        </div>

        {/* Phase / attrition legend */}
        <div className="legend-card" style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 6 }}
          {...tp("Phase legend. Coil width equals remaining candidate count. Click a phase to isolate it.")}>
          {PHASES.map((ph, i) => (
            <div key={i} onClick={() => setActivePhase(activePhase === i ? null : i)}
              {...tp(`${ph.tip} Radius ${SP_RADII[i]}. Click to isolate this coil.`)}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", opacity: activePhase !== null && activePhase !== i ? 0.3 : 1 }}>
              <div style={{ width: 28, height: 3, background: ph.hex, borderRadius: 1, opacity: 0.7 }} />
              <span style={{ color: ph.hex, fontWeight: 600 }}>{ph.label}</span>
              <span style={{ color: C.t3 }}>r={(SP_RADII[i])} ← {i === 0 ? "widest" : i === 4 ? "narrowest" : ""}</span>
            </div>
          ))}
          <div style={{ marginTop: 2, fontSize: 13, color: C.t3, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}
            {...tp("The spiral is an attrition funnel: outer coils hold more molecules, inner coils hold fewer survivors.")}>
            Width = candidate count (attrition)
          </div>
        </div>
      </div>
      <div
        className={`resize-handle${resizing === "right" ? " dragging" : ""}`}
        onPointerDown={startResize("right", rightW)}
        {...tp("Drag to widen or narrow the detail pane.")}
      />

      {/* RIGHT PANEL */}
      <div style={{ width: rightW, flexShrink: 0, background: C.panel, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Search */}
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 5 }}>
            <input value={sq} onChange={e => setSq(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Search UniProt, Reactome…"
              {...tp("Search live UniProt proteins and Reactome pathways. Press Enter or Go.")}
              style={{ flex: 1, fontSize: 15, padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#f9f9f7", color: C.t1, outline: "none" }} />
            <button onClick={doSearch} {...tp("Run the UniProt and Reactome search")}
              style={{ fontSize: 14, padding: "0 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#f2f2ee", color: C.t2, cursor: "pointer", fontFamily: "inherit" }}>
              {searching ? "…" : "Go"}
            </button>
          </div>
          {srRes.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {srRes.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noreferrer"
                  {...tp(`Open this ${r.src} record in a new tab`)}
                  style={{ display: "block", padding: "5px 7px", borderRadius: 5, background: "#f7f7f4", border: `1px solid ${C.border}`, textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, padding: "2px 6px", borderRadius: 5, background: r.col, color: "#fff", fontWeight: 700 }}>{r.src}</span>
                    <span style={{ fontSize: 14, color: "#1a6bc4", fontWeight: 500 }}>{r.name}</span>
                  </div>
                  {r.note && <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.4 }}>{r.note}</div>}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Filters: Phases, Threads */}
        <div style={{ padding: "7px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}
            {...tp("Filter the spiral and workflow list to a single discovery phase. Click again to clear.")}>
            PHASES
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 7 }}>
            {PHASES.map((p, i) => pill(p.label, activePhase === i, p.hex, () => setActivePhase(activePhase === i ? null : i), `${p.tip} Click to isolate; click again to show all phases.`))}
          </div>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}
            {...tp("Filter to a cross-cutting scientific thread. Nodes on that thread stay bright; others dim.")}>
            THREADS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {THREADS.map(th => pill(th.label, activeThread === th.id, th.hex, () => setActiveThread(activeThread === th.id ? null : th.id), `${th.tip} Click to isolate; click again to clear.`))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Node detail */}
        <div style={{ padding: 12 }}>
          {!selNode ? (
            <div style={{ fontSize: 15, color: C.t2, lineHeight: 1.85, marginTop: 8 }}
              {...tp("Click a node on the spiral or in the workflow list to load its assays, databases, and tools here.")}>
              <div style={{ fontSize: 18, fontWeight: 500, color: C.t1, marginBottom: 8 }}>3D Attrition Spiral</div>
              <strong style={{ fontWeight: 500 }}>Part 1 is outermost</strong> (widest radius = most candidates). Each inner coil represents attrition — fewer molecules survive each phase.<br /><br />
              <div style={{ background: "#5B8DB818", border: "1px solid #5B8DB860", borderRadius: 6, padding: "7px 9px", marginBottom: 8 }}
                {...tp("Blue square markers are XL/PTM nodes. They run beside the main workflow at descriptive and atomic resolution.")}>
                <strong style={{ fontWeight: 500, color: "#5B8DB8" }}>Cross-linking nodes</strong> (square markers, blue) run alongside the main workflow. They cover XL-MS methodology, epitope mapping, PTM characterization, disulfide mapping, glycan profiling, and ADC conjugation site analysis at both descriptive and atomic levels.
              </div>
              Drag to orbit · Scroll to zoom · Shift-drag to pan<br />
              Click any node to explore.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 500, color: C.t1 }} {...tp(selNode.detail)}>{selNode.label}</div>
                <div style={{ fontSize: 14, color: C.t2, marginBottom: 5 }} {...tp("Short readout for this step")}>{selNode.sub}</div>
                <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 8, background: ph.hex + "18", color: ph.hex }} {...tp(ph.tip)}>
                  {ph.label} · {ph.desc}
                </span>
                {selNode.dom === "xlink" && (
                  <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 8, background: "#5B8DB820", color: "#5B8DB8", marginLeft: 5 }}
                    {...tp("This node belongs to the cross-linking / PTM lane (square markers).")}>
                    Cross-linking / PTM
                  </span>
                )}
              </div>
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
                {tabBtn("detail", "Detail", "Narrative for this workflow step")}
                {tabBtn("assay", "Assay", "Primary assay, advancement gate, and any loop-back")}
                {tabBtn("databases", "Databases", "Live UniProt and Reactome records linked to this step")}
                {tabBtn("tools", "Tools", "Software tools and scientific threads this step belongs to")}
              </div>

              {tab === "detail" && <div style={{ fontSize: 15, lineHeight: 1.75, color: C.t1 }}>{selNode.detail}</div>}

              {tab === "assay" && (
                <div style={{ fontSize: 15 }}>
                  <div style={{ color: C.t3, marginBottom: 3 }} {...tp("The experimental method used at this step")}>Primary assay</div>
                  <div style={{ fontWeight: 500, color: C.t1, marginBottom: 10 }}>{selNode.assay}</div>
                  {selNode.gate && <div style={{ background: "#fff2ee", border: "1px solid #f5c5b0", borderRadius: 5, padding: "5px 8px", color: "#b84a20" }}
                    {...tp("Advancement criterion. Compare with capability thresholds below for the selected stage.")}>Gate: {selNode.gate}</div>}
                  {selNode.loop && <div style={{ marginTop: 6, background: "#fffbee", border: "1px solid #f0dd99", borderRadius: 5, padding: "5px 8px", color: "#8a6a00" }}
                    {...tp("If the gate fails, work loops back here instead of advancing.")}>↻ {selNode.loop}</div>}
                </div>
              )}

              {tab === "databases" && (
                <div>
                  {dbLoad && <div style={{ fontSize: 15, color: C.t2 }}>Fetching records…</div>}
                  {!dbLoad && !selNode.up.length && !selNode.re.length && <div style={{ fontSize: 15, color: C.t2 }}>No database IDs linked to this step.</div>}
                  {dbRecs.map((rec, i) => (
                    <div key={i} style={{ marginBottom: 8, padding: "7px 9px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#f9f9f7" }}
                      {...tp(rec.type === "uniprot" ? "UniProt protein record fetched live from rest.uniprot.org" : "Reactome pathway record fetched live from reactome.org")}>
                      <div style={{ marginBottom: 3 }}>
                        <span style={{ fontSize: 12, padding: "2px 6px", borderRadius: 6, background: rec.type === "uniprot" ? "#1D9E75" : "#7F77DD", color: "#fff", fontWeight: 700, marginRight: 5 }}>
                          {rec.type === "uniprot" ? "UniProt" : "Reactome"}
                        </span>
                        <a href={rec.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: "#1a6bc4", textDecoration: "none", fontWeight: 500 }}
                          {...tp("Open the source record in a new tab")}>{rec.name}</a>
                      </div>
                      {rec.org && <div style={{ fontSize: 13, color: C.t2 }}>{rec.org}{rec.gene ? " · " + rec.gene : ""}</div>}
                      {rec.fn && <div style={{ fontSize: 13, color: C.t2, marginTop: 3, lineHeight: 1.5 }}>{rec.fn}</div>}
                      {rec.summ && <div style={{ fontSize: 13, color: C.t2, marginTop: 3, lineHeight: 1.5 }}>{rec.summ}</div>}
                      {rec.pbUrl && <a href={rec.pbUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#1a6bc4", marginTop: 4, display: "block" }}
                        {...tp("Open this pathway in the Reactome Pathway Browser")}>Open Pathway Browser →</a>}
                    </div>
                  ))}
                </div>
              )}

              {tab === "tools" && (
                <div>
                  <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}
                    {...tp("Software used at this step")}>CONNECTED TOOLS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                    {selNode.tools.map(t => (
                      <span key={t} style={{ fontSize: 14, padding: "4px 10px", borderRadius: 6, background: "#f2f2ee", border: `1px solid ${C.border}`, color: C.t1 }}
                        {...tp(`${t} is linked to this workflow step`)}>{t}</span>
                    ))}
                  </div>
                  {myT.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}
                        {...tp("Scientific threads that include this node. Click to isolate a thread on the spiral.")}>BELONGS TO THREADS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {myT.map(th => (
                          <button key={th.id} onClick={() => setActiveThread(activeThread === th.id ? null : th.id)}
                            {...tp(th.tip)}
                            style={{ fontSize: 13, padding: "3px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                              border: `1px solid ${th.hex}`, background: activeThread === th.id ? th.hex + "18" : "transparent", color: th.hex }}>
                            {th.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Uniqueness & PTM sites */}
        <div className="side-block" style={{ background: selNode?.id === "x5" ? "#5B8DB810" : "transparent" }}>
          <div className="side-block-title" onClick={jumpToUniqueness} style={{ cursor: "pointer" }}
            {...tp("Same uniqueness-layer model as the R&D dashboard. Click to open the Uniqueness & PTM sites node.")}>
            UNIQUENESS & PTM SITES
          </div>
          <div style={{ fontSize: 13, color: C.t2, marginBottom: 8, lineHeight: 1.45 }}
            {...tp("Configure which crosslink layers contribute to uniqueness at registration. Disulfides are off by default for IgGs.")}>
            Layers that contribute to the registration uniqueness key. Default excludes disulfides.
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
            {XL_LAYERS.map(layer => (
              <div className="layer-row" key={layer.num} style={layer.always ? { background: "#f5f5f3" } : undefined} {...tp(layer.tip)}>
                <div className="layer-num" style={{ background: layer.color, color: layer.textColor || "#fff" }}>{layer.num}</div>
                <div className="layer-name">{layer.name}</div>
                <div className="layer-desc">{layer.desc}</div>
                <div className="tog-wrap">
                  {layer.always ? (
                    <><div className="tog on" /><span>Always on</span></>
                  ) : (
                    <>
                      <div className={`tog${layers[layer.num] ? " on" : ""}`} onClick={() => toggleLayer(layer.num)}
                        {...tp(layers[layer.num] ? "Click to exclude this layer from uniqueness" : "Click to include this layer in uniqueness")} />
                      <span>{layers[layer.num] ? "On" : "Off"}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t3, marginBottom: 4, letterSpacing: "0.06em" }}
            {...tp("Live uniqueness key for iso_326. Faded segments are layers currently switched off.")}>
            LIVE UNIQUENESS KEY
          </div>
          <div className="key-preview" {...tp("Descriptive and atomic registrations resolve to the same key when the enabled layers match.")}>
            <span className="kl kl1">VH_16_4$VL_16_4</span> ·{" "}
            <span className="kl kl2" style={{ opacity: layers[2] ? 1 : 0.3 }}>— (disulfide off)</span> ·{" "}
            <span className="kl kl3" style={{ opacity: layers[3] ? 1 : 0.3 }}>23:R3-45:R3</span> ·{" "}
            <span className="kl kl4" style={{ opacity: layers[4] ? 1 : 0.3 }}>GlcNAc:R1-317:R3</span> ·{" "}
            <span className="kl kl5" style={{ opacity: layers[5] ? 1 : 0.3 }}>Linker:R1-Lys:[unspec]</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t3, margin: "12px 0 4px", letterSpacing: "0.06em" }}
            {...tp("Site-level PTMs that feed uniqueness layer 4 and conjugation layer 5.")}>
            PTM / CONJUGATION SITES
          </div>
          <table className="ptm-table">
            <thead>
              <tr>
                <th {...tp("Modification chemistry")}>Mod</th>
                <th {...tp("Residue or motif")}>Site</th>
                <th {...tp("Uniqueness layer this PTM belongs to")}>Layer</th>
                <th {...tp("Confirmed by XL-MS / peptide mapping, predicted, or still unknown")}>Status</th>
              </tr>
            </thead>
            <tbody>
              {PTM_SITES.map(row => (
                <tr key={row.mod} {...tp(row.tip)}>
                  <td style={{ fontWeight: 600 }}>{row.mod}</td>
                  <td>{row.site}</td>
                  <td>{row.layer}</td>
                  <td style={{ color: row.status === "Confirmed" ? "#1B5E20" : row.status === "Unknown site" ? "#7F0000" : "#6D5300", fontWeight: 600 }}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Capability thresholds */}
        <div className="side-block">
          <div className="side-block-title" {...tp("Green / yellow / red cutoffs used to score assays. Same bands as the R&D dashboard Threshold config.")}>
            CAPABILITY THRESHOLDS
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <select className="stage-select" value={stage} onChange={e => applyStage(e.target.value)}
              {...tp("Load stage-specific defaults. Early screening is looser; candidate nomination is tightest.")}>
              <option value="screening">Early screening</option>
              <option value="lead">Lead selection</option>
              <option value="candidate">Candidate nomination</option>
            </select>
            <button type="button" onClick={() => applyStage(stage)}
              {...tp("Reset the numeric cutoffs to the defaults for this stage")}
              style={{ fontSize: 13, padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#f2f2ee", color: C.t2, cursor: "pointer", fontFamily: "inherit" }}>
              Reset defaults
            </button>
          </div>
          <div className="section-hdr" {...tp("Binding and functional potency vs hTfR1")}>Binding & potency (hTfR1)</div>
          {THRESH_METRICS.slice(0, 4).map(m => (
            <BandRow key={m.key} metric={m} thresh={thresh} setThresh={setThresh} tp={tp} />
          ))}
          <div className="section-hdr" {...tp("Colloidal stability and purity from SEC")}>SEC / colloidal stability</div>
          {THRESH_METRICS.slice(4, 6).map(m => (
            <BandRow key={m.key} metric={m} thresh={thresh} setThresh={setThresh} tp={tp} />
          ))}
          <div className="section-hdr" {...tp("Expression titer required to advance")}>Production</div>
          {THRESH_METRICS.slice(6).map(m => (
            <BandRow key={m.key} metric={m} thresh={thresh} setThresh={setThresh} tp={tp} />
          ))}
        </div>

        {/* Registration access — below uniqueness & PTM */}
        <div className="side-block">
          <div className="side-block-title" {...tp("External registries and databases used when registering sequences and structures.")}>
            REGISTRATION ACCESS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {REG_LINKS.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer" {...tp(r.tip)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 7px", borderRadius: 5,
                  background: r.col + "10", border: `1px solid ${r.col}40`, textDecoration: "none" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.col, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: r.col, fontWeight: 500 }}>{r.label} ↗</span>
              </a>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
    {tip && (
      <div className="float-tip" style={{ left: Math.min(tip.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300), top: Math.min(tip.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 90) }}>
        {tip.text}
      </div>
    )}
    </>
  );
}
