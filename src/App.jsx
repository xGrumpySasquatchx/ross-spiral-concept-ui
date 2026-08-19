import { useState, useRef, useEffect, useCallback } from "react";

/* ── palette ── */
const C = {
  bg: "#f6f6f2", panel: "#ffffff", border: "#e2e2da",
  t1: "#1a1a1a", t2: "#555", t3: "#999",
};

/* ── phases: Part 1 = outermost (widest radius) → attrition inward ── */
const PHASES = [
  { label: "Part 1", desc: "mAb Discovery",       hex: "#1D9E75" },
  { label: "Part 2", desc: "Format Design",       hex: "#7F77DD" },
  { label: "Part 3", desc: "Expression & Char.",  hex: "#378ADD" },
  { label: "Part 4", desc: "Protein Engineering", hex: "#BA7517" },
  { label: "Part 5", desc: "VHH / BoltzGen",      hex: "#993556" },
];

const DCOL = {
  molbio: "#1D9E75", protein: "#7F77DD", bioinf: "#378ADD",
  assay: "#BA7517", decision: "#D85A30", engineer: "#993556",
  xlink: "#5B8DB8",
};

const THREADS = [
  { id: "seq",   label: "Sequence",         hex: "#E24B4A", nodes: ["n5","n10","n11","n12","n15","n16","n28","n31","n32","n36","n38"] },
  { id: "cross", label: "Cross-reactivity", hex: "#1D9E75", nodes: ["n7","n8","n14","n21"] },
  { id: "dev",   label: "Developability",   hex: "#378ADD", nodes: ["n8","n9","n14","n19","n20","n25","n30"] },
  { id: "human", label: "Humanization",     hex: "#993556", nodes: ["n24","n33","n34","n35","n36","n38"] },
  { id: "luma",  label: "Luma",             hex: "#7F77DD", nodes: ["n1","n2","n6","n10","n12","n15","n17","n22","n28","n30","n37","n38"] },
  { id: "xlink", label: "Cross-linking",    hex: "#5B8DB8", nodes: ["x1","x2","x3","x4","x5","x6","x7","x8","x9"] },
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
  const [rightW, setRightW] = useState(380);
  const [resizing, setResizing] = useState(null);
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

  const pill = (label, active, col, onClick) => (
    <button onClick={onClick} style={{ fontSize: 13, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
      border: `1px solid ${active ? col : C.border}`, background: active ? col + "20" : "#f5f5f2", color: active ? col : C.t2 }}>
      {label}
    </button>
  );

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ fontSize: 14, padding: "5px 12px", background: "transparent", border: "none",
      borderBottom: tab === id ? `2px solid ${C.t1}` : "2px solid transparent",
      color: tab === id ? C.t1 : C.t3, cursor: "pointer", fontFamily: "inherit" }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.t1, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflow: "hidden", userSelect: resizing ? "none" : "auto", cursor: resizing ? "col-resize" : "default" }}>

      {/* LEFT LANE — vertical workflow-step navigator (Ross Spiral sidebar) */}
      <div style={{ width: leftW, flexShrink: 0, background: C.panel, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 8px 6px", fontSize: 13, fontWeight: 700, color: C.t3, letterSpacing: "0.08em" }}>WORKFLOW STEPS</div>
        {PHASES.map((ph, i) => {
          const phNodes = NODES.filter(n => n.ph === i);
          const isOpen = laneOpen[i];
          return (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <div onClick={() => setLaneOpen(o => ({ ...o, [i]: !o[i] }))}
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
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 18px", cursor: "pointer", opacity: dim ? 0.2 : 1,
                      background: isSel ? DCOL[nd.dom] + "18" : "transparent",
                      borderLeft: isSel ? `2px solid ${DCOL[nd.dom]}` : "2px solid transparent" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: DCOL[nd.dom], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: isSel ? C.t1 : C.t2, flex: 1, lineHeight: 1.3 }}>{nd.label}</span>
                    {nd.loop && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#D85A30", flexShrink: 0 }} />}
                    {(nd.up.length > 0 || nd.re.length > 0) && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#378ADD", flexShrink: 0 }} />}
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
        title="Drag to resize"
      />

      {/* CENTER — 3D orbit spiral (pure SVG, no Three.js dependency) */}
      <div ref={svgRef} style={{ flex: 1, position: "relative", overflow: "hidden", cursor: drag.current.down ? "grabbing" : "grab", userSelect: "none" }}
        onPointerDown={onPDWrapped} onPointerMove={onPMWrapped} onPointerUp={onPU} onPointerLeave={onPU}
        onContextMenu={e => e.preventDefault()}>

        <svg width="100%" height="100%" viewBox="0 0 580 420" style={{ display: "block", background: C.bg }}
          onClick={handleBgClick}>

          {/* Helix tube lines */}
          {helixLines.map(({ ph, pts, i }) => {
            const dim = activePhase !== null && activePhase !== i;
            const d = pts.map((p, j) => j === 0 ? `M${p.sx.toFixed(1)},${p.sy.toFixed(1)}` : `L${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");
            return <path key={i} d={d} fill="none" stroke={ph.hex} strokeWidth={1.8} strokeOpacity={dim ? 0.05 : 0.22}
              strokeDasharray={i === 0 ? "5 4" : i === 4 ? "2 3" : "none"} />;
          })}

          {/* Thread dashed lines */}
          {threadPaths.map(({ th, segs, isActive }) => (
            <path key={th.id} d={segs.join(" ")} fill="none" stroke={th.hex}
              strokeWidth={isActive ? 2 : 1} strokeOpacity={isActive ? 0.9 : activeThread ? 0.07 : 0.22} />
          ))}

          {/* Loop-back arcs */}
          {NODES.filter(n => n.loop).map(nd => {
            const p3 = helixXYZ(nd.ph, nd.t);
            const { sx: x, sy: y } = project({ x: p3.x * zoom, y: p3.y * zoom, z: p3.z * zoom }, theta, phi, FOV, CX + panXY.x, CY + panXY.y);
            return (
              <g key={nd.id + "_lp"}>
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
              <g key={nd.id} onClick={e => handleNodeClick(nd, e)} style={{ cursor: "pointer" }}>
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
          {[["＋", () => setZoom(z => Math.min(4, z * 1.25))],
            ["⟲", () => { setZoom(1); setTheta(0.3); setPhi(0.4); setPanXY({ x: 0, y: 0 }); }],
            ["－", () => setZoom(z => Math.max(0.3, z / 1.25))]
          ].map(([l, fn]) => (
            <button key={l} onClick={fn} style={{ width: 32, height: 32, border: `1px solid ${C.border}`, borderRadius: 6, background: C.panel, color: C.t2, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</button>
          ))}
          <div style={{ fontSize: 13, color: C.t3, textAlign: "center" }}>{Math.round(zoom * 100)}%</div>
        </div>

        <div style={{ position: "absolute", top: 8, left: 8, fontSize: 13, color: C.t3, lineHeight: 1.8, pointerEvents: "none" }}>
          Drag · orbit &nbsp;|&nbsp; Scroll · zoom &nbsp;|&nbsp; Shift-drag · pan &nbsp;|&nbsp; Right-click · menu off
        </div>

        {/* Phase / attrition legend */}
        <div className="legend-card" style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {PHASES.map((ph, i) => (
            <div key={i} onClick={() => setActivePhase(activePhase === i ? null : i)}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", opacity: activePhase !== null && activePhase !== i ? 0.3 : 1 }}>
              <div style={{ width: 28, height: 3, background: ph.hex, borderRadius: 1, opacity: 0.7 }} />
              <span style={{ color: ph.hex, fontWeight: 600 }}>{ph.label}</span>
              <span style={{ color: C.t3 }}>r={(SP_RADII[i])} ← {i === 0 ? "widest" : i === 4 ? "narrowest" : ""}</span>
            </div>
          ))}
          <div style={{ marginTop: 2, fontSize: 13, color: C.t3, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
            Width = candidate count (attrition)
          </div>
        </div>
      </div>
      <div
        className={`resize-handle${resizing === "right" ? " dragging" : ""}`}
        onPointerDown={startResize("right", rightW)}
        title="Drag to resize"
      />

      {/* RIGHT PANEL */}
      <div style={{ width: rightW, flexShrink: 0, background: C.panel, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Search */}
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 5 }}>
            <input value={sq} onChange={e => setSq(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Search UniProt, Reactome…"
              style={{ flex: 1, fontSize: 15, padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#f9f9f7", color: C.t1, outline: "none" }} />
            <button onClick={doSearch} style={{ fontSize: 14, padding: "0 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#f2f2ee", color: C.t2, cursor: "pointer", fontFamily: "inherit" }}>
              {searching ? "…" : "Go"}
            </button>
          </div>
          {srRes.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {srRes.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noreferrer"
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

        {/* Filters: Phases, Threads, Registration Access */}
        <div style={{ padding: "7px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}>PHASES</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 7 }}>
            {PHASES.map((p, i) => pill(p.label, activePhase === i, p.hex, () => setActivePhase(activePhase === i ? null : i)))}
          </div>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}>THREADS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 7 }}>
            {THREADS.map(th => pill(th.label, activeThread === th.id, th.hex, () => setActiveThread(activeThread === th.id ? null : th.id)))}
          </div>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}>REGISTRATION ACCESS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              { label: "Luma sequence registry", url: "https://dotmatics.com/products/luma", col: "#7F77DD" },
              { label: "UniProt entry", url: "https://www.uniprot.org/uniprot/P02786", col: "#1D9E75" },
              { label: "GenBank nucleotide", url: "https://www.ncbi.nlm.nih.gov/nuccore/", col: "#378ADD" },
              { label: "Reactome browser", url: "https://reactome.org/PathwayBrowser/", col: "#BA7517" },
              { label: "IMGT/V-QUEST", url: "https://www.imgt.org/IMGT_vquest/", col: "#993556" },
              { label: "PDB structure search", url: "https://www.rcsb.org/", col: "#5B8DB8" },
            ].map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 7px", borderRadius: 5,
                  background: r.col + "10", border: `1px solid ${r.col}40`, textDecoration: "none" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.col, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: r.col, fontWeight: 500 }}>{r.label} ↗</span>
              </a>
            ))}
          </div>
        </div>

        {/* Node detail */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {!selNode ? (
            <div style={{ fontSize: 15, color: C.t2, lineHeight: 1.85, marginTop: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: C.t1, marginBottom: 8 }}>3D Attrition Spiral</div>
              <strong style={{ fontWeight: 500 }}>Part 1 is outermost</strong> (widest radius = most candidates). Each inner coil represents attrition — fewer molecules survive each phase.<br /><br />
              <div style={{ background: "#5B8DB818", border: "1px solid #5B8DB860", borderRadius: 6, padding: "7px 9px", marginBottom: 8 }}>
                <strong style={{ fontWeight: 500, color: "#5B8DB8" }}>Cross-linking nodes</strong> (square markers, blue) run alongside the main workflow. They cover XL-MS methodology, epitope mapping, PTM characterization, disulfide mapping, glycan profiling, and ADC conjugation site analysis at both descriptive and atomic levels.
              </div>
              Drag to orbit · Scroll to zoom · Shift-drag to pan<br />
              Click any node to explore.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 500, color: C.t1 }}>{selNode.label}</div>
                <div style={{ fontSize: 14, color: C.t2, marginBottom: 5 }}>{selNode.sub}</div>
                <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 8, background: ph.hex + "18", color: ph.hex }}>
                  {ph.label} · {ph.desc}
                </span>
                {selNode.dom === "xlink" && (
                  <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 8, background: "#5B8DB820", color: "#5B8DB8", marginLeft: 5 }}>
                    Cross-linking / PTM
                  </span>
                )}
              </div>
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
                {tabBtn("detail", "Detail")}{tabBtn("assay", "Assay")}{tabBtn("databases", "Databases")}{tabBtn("tools", "Tools")}
              </div>

              {tab === "detail" && <div style={{ fontSize: 15, lineHeight: 1.75, color: C.t1 }}>{selNode.detail}</div>}

              {tab === "assay" && (
                <div style={{ fontSize: 15 }}>
                  <div style={{ color: C.t3, marginBottom: 3 }}>Primary assay</div>
                  <div style={{ fontWeight: 500, color: C.t1, marginBottom: 10 }}>{selNode.assay}</div>
                  {selNode.gate && <div style={{ background: "#fff2ee", border: "1px solid #f5c5b0", borderRadius: 5, padding: "5px 8px", color: "#b84a20" }}>Gate: {selNode.gate}</div>}
                  {selNode.loop && <div style={{ marginTop: 6, background: "#fffbee", border: "1px solid #f0dd99", borderRadius: 5, padding: "5px 8px", color: "#8a6a00" }}>↻ {selNode.loop}</div>}
                </div>
              )}

              {tab === "databases" && (
                <div>
                  {dbLoad && <div style={{ fontSize: 15, color: C.t2 }}>Fetching records…</div>}
                  {!dbLoad && !selNode.up.length && !selNode.re.length && <div style={{ fontSize: 15, color: C.t2 }}>No database IDs linked to this step.</div>}
                  {dbRecs.map((rec, i) => (
                    <div key={i} style={{ marginBottom: 8, padding: "7px 9px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#f9f9f7" }}>
                      <div style={{ marginBottom: 3 }}>
                        <span style={{ fontSize: 12, padding: "2px 6px", borderRadius: 6, background: rec.type === "uniprot" ? "#1D9E75" : "#7F77DD", color: "#fff", fontWeight: 700, marginRight: 5 }}>
                          {rec.type === "uniprot" ? "UniProt" : "Reactome"}
                        </span>
                        <a href={rec.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: "#1a6bc4", textDecoration: "none", fontWeight: 500 }}>{rec.name}</a>
                      </div>
                      {rec.org && <div style={{ fontSize: 13, color: C.t2 }}>{rec.org}{rec.gene ? " · " + rec.gene : ""}</div>}
                      {rec.fn && <div style={{ fontSize: 13, color: C.t2, marginTop: 3, lineHeight: 1.5 }}>{rec.fn}</div>}
                      {rec.summ && <div style={{ fontSize: 13, color: C.t2, marginTop: 3, lineHeight: 1.5 }}>{rec.summ}</div>}
                      {rec.pbUrl && <a href={rec.pbUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#1a6bc4", marginTop: 4, display: "block" }}>Open Pathway Browser →</a>}
                    </div>
                  ))}
                </div>
              )}

              {tab === "tools" && (
                <div>
                  <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}>CONNECTED TOOLS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                    {selNode.tools.map(t => (
                      <span key={t} style={{ fontSize: 14, padding: "4px 10px", borderRadius: 6, background: "#f2f2ee", border: `1px solid ${C.border}`, color: C.t1 }}>{t}</span>
                    ))}
                  </div>
                  {myT.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, color: C.t3, marginBottom: 5, fontWeight: 700, letterSpacing: "0.07em" }}>BELONGS TO THREADS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {myT.map(th => (
                          <button key={th.id} onClick={() => setActiveThread(activeThread === th.id ? null : th.id)}
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
      </div>
    </div>
  );
}
