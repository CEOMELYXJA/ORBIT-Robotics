/* Satellite fictif sur une orbite circulaire à deux corps. Temps en secondes
   depuis un passage ascendant fictif au-dessus de Greenwich (t = 0).
   Aucune date UTC, donnée de suivi, perturbation ou commande de mission. */
(() => {
  'use strict';

  // NASA/JPL, paramètres astrodynamiques et planétaires, consultés le 22/11/2026.
  // https://ssd.jpl.nasa.gov/astro_par.html
  // https://ssd.jpl.nasa.gov/planets/phys_par.html
  const radiusKm = 6371; // Rayon moyen arrondi, comme dans le laboratoire ORBIT-Space.
  const muKm3S2 = 398600.435507;
  const siderealDaySeconds = 86164.09054;
  const altitudeKm = 400;
  const inclinationDeg = 52;
  const radiansPerDegree = Math.PI / 180;
  const fullTurn = 2 * Math.PI;
  const orbitRadiusKm = radiusKm + altitudeKm;
  const orbitRadius = orbitRadiusKm / radiusKm;
  const speedKmS = Math.sqrt(muKm3S2 / orbitRadiusKm); // Vitesse dans le repère inertiel.
  const periodSeconds = fullTurn * orbitRadiusKm / speedKmS;
  const cosInclination = Math.cos(inclinationDeg * radiansPerDegree);
  const sinInclination = Math.sin(inclinationDeg * radiansPerDegree);

  // Phase orbitale absolue en radians. Le méridien de Greenwich tourne vers
  // l'est. Une rotation de -theta exprime le vecteur dans les axes terrestres
  // x = 0° E, y = 90° E, z = nord. Les distances sont en rayons terrestres.
  function orbitPointAt(phaseRadians, seconds) {
    if (!Number.isFinite(phaseRadians) || !Number.isFinite(seconds)) {
      throw new RangeError('La phase et le temps doivent être des nombres finis.');
    }
    const theta = fullTurn * ((seconds % siderealDaySeconds) / siderealDaySeconds);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const xInertial = orbitRadius * Math.cos(phaseRadians);
    const yInPlane = orbitRadius * Math.sin(phaseRadians);
    const yInertial = yInPlane * cosInclination;
    return {
      x: xInertial * cosTheta + yInertial * sinTheta,
      y: yInertial * cosTheta - xInertial * sinTheta,
      z: yInPlane * sinInclination,
    };
  }

  function stateAt(seconds) {
    if (!Number.isFinite(seconds)) throw new RangeError('Le temps doit être un nombre fini.');
    const phase = fullTurn * ((seconds % periodSeconds) / periodSeconds);
    const {x, y, z} = orbitPointAt(phase, seconds);
    return {
      x, y, z,
      latitudeDeg: Math.atan2(z, Math.hypot(x, y)) / radiansPerDegree,
      longitudeDeg: Math.atan2(y, x) / radiansPerDegree,
      altitudeKm,
      speedKmS,
    };
  }

  const model = Object.freeze({
    stateAt, orbitPointAt, radiusKm, altitudeKm, inclinationDeg, speedKmS,
    periodSeconds, siderealDaySeconds,
  });
  if (typeof window !== 'undefined') window.OrbitEarthModel = model;
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
})();
