/** Shared bulk-exam-planner style fixtures for MYP5 (5 subjects). */

export type Myp5SyllabusEntry = {
  id: string;
  subject: string;
  examDateKey: string;
  text: string;
};

export const MYP5_SYLLABI_ENTRIES: Myp5SyllabusEntry[] = [
  {
    id: 'subj-math',
    subject: 'Extended Mathematics',
    examDateKey: '2026-05-20',
    text: `EXTENDED MATH: Unit 1 – Numerical and Abstract Reasoning: Number systems and notation; Absolute values; Inequalities (compound & double); Number sequences; Surds, roots & radicals; Laws of exponents; Standard form; Direct & inverse proportion

Algebra: General rules for sequences; Simultaneous equations (algebraic & graphical); Inequalities; Factorizing quadratics; Solving quadratics; Rearranging formulae

Extended (Unit-1): Lower & upper bounds; Logarithms; Fractional exponents; Arithmetic & geometric sequences

Unit 2 – Thinking with Models: Mapping; Function notation; Linear functions; Parallel & perpendicular lines; Simultaneous equations; Quadratic functions; Exponential functions; Algorithms

Extended (Unit-2): Domain & range; Rational functions; Linear programming; Transformations of quadratics; Cubic, rational, trig & log functions; Networks & pathways; Weighted networks

Unit 3 – Spatial Reasoning (Geometry): Metric conversions; Circle theorems; Arc & sector measures; 3D shapes; Gradients; Coordinate geometry; Rotation; Similarity & congruence; Transformations

Trigonometry: Triangle properties; Bearings; Pythagoras' theorem; Trigonometric ratios

Extended (Unit-3): Capacity; Perpendicular gradients; Enlargements; Transformations; Converse of Pythagoras; Sine & cosine rule

Unit 4 – Reasoning with Data: Sampling; Data interpretation; Graphs; Best fit lines; Averages; Dispersion; Correlation; Sets; Probability (Venn, tree, sample space); Events & frequency

Extended (Unit-4): Histograms; Standard deviation; Correlation (technology); Dependent & independent probability; Conditional probability`,
  },
  {
    id: 'subj-eng',
    subject: 'English',
    examDateKey: '2026-05-15',
    text: `Task 1 – Compare & Contrast and Short Answer Questions

Task 2 – Producing Literary Texts: Descriptive writing (paragraphs & essays); Narrative writing (stories of different genres); Dialogue, script & monologue writing

Task 3 – Producing Non-Literary Texts: Letter writing; Article/blog writing; Speech writing; Screenplay writing; Journal writing; Proposal writing`,
  },
  {
    id: 'subj-phy',
    subject: 'Physics',
    examDateKey: '2026-05-22',
    text: `Unit 1: Measurement and Motion: SI units, measurement techniques (Vernier Calliper, screw gauge), accuracy, precision, errors, measurement of density, time (time period of pendulum etc) scalars and vectors, distance, displacement, speed, velocity, acceleration, motion graphs, equations of motion, free fall, reaction time, braking distance, stopping distance, thinking distance, safety (crumple zone, seat belts etc.) basics of projectile motion

Unit 2: Forces: Types of Forces, Balanced, Unbalanced forces, Resultant Force (Parallelogram Law and Resolution of Forces) Newton's laws, inertia, friction, drag forces, circular motion, mass and weight, momentum, impulse, conservation of momentum, Hooke's law, Terminal velocity, compressive and tensile forces, Moment of force, Principle of moments, Pressure, Atmospheric pressure, Floatation

Unit 3: Energy and Thermal Effects: Work, power, energy and its Types, kinetic and potential energy, elastic potential energy conservation of energy, efficiency, specific heat capacity, latent heat, heat transfer (conduction, convection, radiation), thermal expansion, Newton's law of cooling.

Unit 4: Waves: Transverse and longitudinal waves, wave properties (wavelength, frequency, amplitude, speed), reflection light (plane and spherical mirrors), refraction (lenses, prism, glass slab), magnification, Snell's Law, refractive index, critical angle, total internal reflection and applications including optical fibres and endoscopy, diffraction, sound waves, echo, applications, electromagnetic spectrum

Unit 5: Electricity: Charge, static electricity, current, voltage, resistance, Ohm's law, Non Ohmic conductors, series and parallel circuits, electrical energy, power, factors affecting resistance, heating effects of current, applications, Domestic circuits, fuse, hazards in electric circuits

Unit 6: Electromagnetism: Properties of Magnetic field, Right hand thumb rule Magnetic field due to straight current carrying conductor, circular coil, solenoid, force on a current carrying conductor, Fleming's Left-hand rule and Right-hand rule, Lenz's law, electromagnetic induction, transformers, AC generators, DC motors, transmission of electricity.

Unit 7: Atomic Physics: Isotopes, atomic models, Alpha Scattering Experiment, Alpha, Beta, Gamma decay, radioactivity, half-life, background radiation, Geiger counter, nuclear fission, nuclear fusion, nuclear reactor, hazards, precautions, applications.

Unit 8: Astrophysics: Solar system, Big Bang Theory, life cycle of stars, orbital motion, red shift, cosmic microwave background radiation (CMBR), Kepler's laws, Hubble's Law, Doppler Effect in astronomy; ray diagrams of convex and concave lenses, lens formula, application of lenses in telescopes.`,
  },
  {
    id: 'subj-chem',
    subject: 'Chemistry',
    examDateKey: '2026-05-25',
    text: `Periodic table (metals and nonmetals; transition metals, noble gases, trends, periods, groups)

International Union of Pure and Applied Chemistry — IUPAC naming and classification of alkanes, alkenes, alcohols, carboxylic acids and esters; structural formulas

The atmosphere (characteristics of gases; atmospheric composition, testing and treatment; extraction, emission and environmental implications)

Matter (states and properties of matter; particle/kinetic theory, diffusion; atomic structure including isotopes; electron configuration and valency)

Pure and impure substances (types of mixtures solutions, oils, alloys, emulsions; separation techniques, including filtration, distillation including crude oil, chromatography)

Bonding (structure and bonding, properties, chemical formulas, chemical reactions and the conservation of mass; balancing equations, the mole concept and chemical calculations; reaction kinetics rates, and factors affecting rates/collision theory; equilibria/reversible reactions; energy changes in reactions, endo- and exothermicity; combustion of fuels)

Types of chemical reaction (acids and bases, neutral solutions, acid/base reactions, pH and indicators, formation of salts, uses of salts; redox reactions, reactivity series; extraction of metals, and corrosion, electrochemical cells)`,
  },
  {
    id: 'subj-ih',
    subject: 'Individuals and Societies',
    examDateKey: '2026-05-28',
    text: `Unit 1: Why do individuals form social groups?
Unit 2: Why are empires formed?
Unit 3: How do empires work?
Unit 4: How do empires fall?
Unit 5: What impacts do humans have on natural environments?
Unit 6: How does population change affect individuals and societies?
Unit 7: Can urban systems and environments be managed sustainably?
Unit 8: How do we decide what to produce?
Unit 9: Can we make a fairer world through trade?
Unit 10: How can developing countries successfully increase standards of living?
Unit 11: Is our exploitation of the earth sustainable?`,
  },
];
