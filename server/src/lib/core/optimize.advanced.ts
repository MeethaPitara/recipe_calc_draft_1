// Advanced optimization algorithms: Genetic Algorithm + Particle Swarm Optimization
import { IngredientData } from '../../types/ingredients';
import { calcMetricsV2, MetricsV2 } from './calc.v2.js';
import { optimizeRecipe as hillClimbOptimize, Row, OptimizeTarget } from './optimize.js';

// Configuration for advanced optimizers
export type OptimizerConfig = {
  algorithm: 'hill-climbing' | 'genetic' | 'particle-swarm' | 'hybrid';
  maxIterations?: number;
  populationSize?: number; // for GA/PSO
  mutationRate?: number;   // for GA
  crossoverRate?: number;  // for GA
  inertia?: number;        // for PSO
  cognitive?: number;      // for PSO
  social?: number;         // for PSO
  convergenceThreshold?: number;
};

// Default configurations
export const DEFAULT_CONFIG: OptimizerConfig = {
  algorithm: 'hill-climbing',
  maxIterations: 200,
  populationSize: 30,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  inertia: 0.7,
  cognitive: 1.5,
  social: 1.5,
  convergenceThreshold: 0.001
};

// Objective function — sensory-importance weighted errors
// Weights: fat×2, msnf×2, sugars×1, ts×1, FPDT×5 (non-linear, LP can't touch it), AFP×1.5, SP×1.5
function objective(m: MetricsV2, t: OptimizeTarget): number {
  let s = 0;
  if (t.fat_pct != null) s += Math.abs(m.fat_pct - t.fat_pct) * 2.0;
  if (t.msnf_pct != null) s += Math.abs(m.msnf_pct - t.msnf_pct) * 2.0;
  if (t.totalSugars_pct != null) s += Math.abs(m.totalSugars_pct - t.totalSugars_pct) * 1.0;
  if (t.sugars_pct != null) s += Math.abs(m.nonLactoseSugars_pct - t.sugars_pct) * 1.0;
  if (t.ts_pct != null) s += Math.abs(m.ts_pct - t.ts_pct) * 1.0;
  if (t.fpdt != null) s += Math.abs(m.fpdt - t.fpdt) * 5.0;
  if (t.afp_target != null) s += Math.abs(m.afp_index - t.afp_target) * 1.5;
  if (t.pod_target != null) s += Math.abs(m.sp_pct - t.pod_target) * 1.5;
  return s;
}

// Genetic Algorithm Implementation
function geneticAlgorithm(
  rowsIn: Row[],
  targets: OptimizeTarget,
  config: OptimizerConfig
): Row[] {
  const { maxIterations = 200, populationSize = 30, mutationRate = 0.15, crossoverRate = 0.7 } = config;

  // Initialize population
  let population: Row[][] = [];
  for (let i = 0; i < populationSize; i++) {
    const individual = rowsIn.map(r => ({
      ...r,
      grams: Math.max(r.min ?? 0, Math.min(r.max ?? 1e9, r.grams + (Math.random() - 0.5) * 100))
    }));
    population.push(individual);
  }

  let bestIndividual = population[0];
  let bestScore = objective(calcMetricsV2(bestIndividual), targets);
  let noImprovement = 0;

  for (let gen = 0; gen < maxIterations; gen++) {
    // Evaluate fitness
    const fitness = population.map(ind => {
      const m = calcMetricsV2(ind);
      return 1 / (1 + objective(m, targets)); // Higher is better
    });

    // Selection (tournament)
    const selected: Row[][] = [];
    for (let i = 0; i < populationSize; i++) {
      const a = Math.floor(Math.random() * populationSize);
      const b = Math.floor(Math.random() * populationSize);
      selected.push(fitness[a] > fitness[b] ? population[a] : population[b]);
    }

    // Crossover
    const offspring: Row[][] = [];
    for (let i = 0; i < populationSize; i += 2) {
      if (Math.random() < crossoverRate && i + 1 < populationSize) {
        const parent1 = selected[i];
        const parent2 = selected[i + 1];
        const crossPoint = Math.floor(Math.random() * parent1.length);

        const child1 = parent1.map((r, idx) => ({
          ...r,
          grams: idx < crossPoint ? r.grams : parent2[idx].grams
        }));
        const child2 = parent2.map((r, idx) => ({
          ...r,
          grams: idx < crossPoint ? r.grams : parent1[idx].grams
        }));

        offspring.push(child1, child2);
      } else {
        offspring.push(selected[i]);
        if (i + 1 < populationSize) offspring.push(selected[i + 1]);
      }
    }

    // Mutation
    population = offspring.map(ind => {
      if (Math.random() < mutationRate) {
        const mutIdx = Math.floor(Math.random() * ind.length);
        if (!ind[mutIdx].lock) {
          const delta = (Math.random() - 0.5) * 50;
          ind[mutIdx].grams = Math.max(
            ind[mutIdx].min ?? 0,
            Math.min(ind[mutIdx].max ?? 1e9, ind[mutIdx].grams + delta)
          );
        }
      }
      return ind;
    });

    // Track best — snapshot score BEFORE reduce so convergence comparison is valid
    const prevBestScore = bestScore;
    population.reduce((best, ind) => {
      const score = objective(calcMetricsV2(ind), targets);
      if (score < bestScore) { bestScore = score; bestIndividual = ind; return ind; }
      return best;
    }, bestIndividual);

    // Convergence check: compare new best against the pre-generation snapshot
    if (Math.abs(bestScore - prevBestScore) < 0.001) {
      noImprovement++;
      if (noImprovement > 20) break;
    } else {
      noImprovement = 0;
    }
  }

  return bestIndividual;
}

// Particle Swarm Optimization Implementation
function particleSwarmOptimization(
  rowsIn: Row[],
  targets: OptimizeTarget,
  config: OptimizerConfig
): Row[] {
  const { maxIterations = 200, populationSize = 30, inertia = 0.7, cognitive = 1.5, social = 1.5 } = config;

  // Initialize particles
  type Particle = {
    position: Row[];
    velocity: number[];
    bestPosition: Row[];
    bestScore: number;
  };

  const particles: Particle[] = [];
  for (let i = 0; i < populationSize; i++) {
    const position = rowsIn.map(r => ({
      ...r,
      grams: Math.max(r.min ?? 0, Math.min(r.max ?? 1e9, r.grams + (Math.random() - 0.5) * 100))
    }));
    const velocity = position.map(() => (Math.random() - 0.5) * 20);
    const score = objective(calcMetricsV2(position), targets);

    particles.push({
      position,
      velocity,
      bestPosition: position.map(r => ({ ...r })),
      bestScore: score
    });
  }

  let globalBest = particles[0].bestPosition;
  let globalBestScore = particles[0].bestScore;
  const initialPSOScore = globalBestScore; // snapshot for relative convergence check

  for (let iter = 0; iter < maxIterations; iter++) {
    for (const particle of particles) {
      // Update velocity and position
      for (let i = 0; i < particle.position.length; i++) {
        if (particle.position[i].lock) continue;

        const r1 = Math.random();
        const r2 = Math.random();

        particle.velocity[i] =
          inertia * particle.velocity[i] +
          cognitive * r1 * (particle.bestPosition[i].grams - particle.position[i].grams) +
          social * r2 * (globalBest[i].grams - particle.position[i].grams);

        particle.position[i].grams = Math.max(
          particle.position[i].min ?? 0,
          Math.min(
            particle.position[i].max ?? 1e9,
            particle.position[i].grams + particle.velocity[i]
          )
        );
      }

      // Evaluate
      const score = objective(calcMetricsV2(particle.position), targets);

      // Update personal best
      if (score < particle.bestScore) {
        particle.bestScore = score;
        particle.bestPosition = particle.position.map(r => ({ ...r }));
      }

      // Update global best
      if (score < globalBestScore) {
        globalBestScore = score;
        globalBest = particle.position.map(r => ({ ...r }));
      }
    }

    // Convergence check — relative to initial score (absolute 0.1 doesn't scale across target sets)
    const convergenceTarget = initialPSOScore > 0 ? initialPSOScore * 0.01 : 0.1;
    if (globalBestScore < convergenceTarget) break;
  }

  return globalBest;
}

// Hybrid approach: GA for exploration + Hill-climbing for refinement
function hybridOptimization(
  rowsIn: Row[],
  targets: OptimizeTarget,
  config: OptimizerConfig
): Row[] {
  // Phase 1: Genetic algorithm for broad search (50% of iterations)
  const gaConfig = { ...config, maxIterations: Math.floor((config.maxIterations ?? 200) * 0.5) };
  const gaResult = geneticAlgorithm(rowsIn, targets, gaConfig);

  // Phase 2: Hill-climbing for local refinement
  // Note: the new LP solver replaced hill climbing, so we just use the LP solver here
  const refinedResult = hillClimbOptimize(gaResult, targets, undefined, 'gelato');

  return refinedResult.rows;
}

// Main entry point
export function advancedOptimize(
  rowsIn: Row[],
  targets: OptimizeTarget,
  config: OptimizerConfig = DEFAULT_CONFIG
): Row[] {
  switch (config.algorithm) {
    case 'genetic':
      return geneticAlgorithm(rowsIn, targets, config);
    case 'particle-swarm':
      return particleSwarmOptimization(rowsIn, targets, config);
    case 'hybrid':
      return hybridOptimization(rowsIn, targets, config);
    case 'hill-climbing':
    default: {
      const res = hillClimbOptimize(rowsIn, targets, undefined, 'gelato');
      return res.rows;
    }
  }
}

// Performance comparison utility
export function compareOptimizers(
  rowsIn: Row[],
  targets: OptimizeTarget,
  algorithms: OptimizerConfig['algorithm'][] = ['hill-climbing', 'genetic', 'particle-swarm', 'hybrid']
): {
  algorithm: string;
  score: number;
  time: number;
  result: Row[];
}[] {
  const results = [];

  for (const algo of algorithms) {
    const start = performance.now();
    const result = advancedOptimize(rowsIn, targets, { algorithm: algo, maxIterations: 100 });
    const end = performance.now();

    const metrics = calcMetricsV2(result);
    const score = objective(metrics, targets);

    results.push({
      algorithm: algo,
      score,
      time: end - start,
      result
    });
  }

  return results.sort((a, b) => a.score - b.score);
}
