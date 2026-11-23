const assert = require('node:assert/strict');
const test = require('node:test');
const earth = require('../spatial/earth-model.js');

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected} (±${tolerance})`);
}

test('Altitude, vitesse et période concordent avec le laboratoire ORBIT-Space à 400 km', () => {
  const epoch = earth.stateAt(0);
  near(epoch.altitudeKm, 400);
  near(epoch.speedKmS, 7.6726, 0.0001);
  near(earth.periodSeconds, 5544.86, 0.01);
  near(epoch.x, 1 + 400 / 6371);
  near(epoch.y, 0);
  near(epoch.z, 0);
  near(epoch.latitudeDeg, 0);
  near(epoch.longitudeDeg, 0);
});

test('La latitude atteint les deux extrema; la longitude du nœud dérive vers l’ouest', () => {
  near(earth.stateAt(earth.periodSeconds / 4).latitudeDeg, 52);
  near(earth.stateAt(-earth.periodSeconds / 4).latitudeDeg, -52);
  near(earth.stateAt(earth.periodSeconds / 4).longitudeDeg,
       90 - 360 * earth.periodSeconds / (4 * earth.siderealDaySeconds));
  const nextNode = earth.stateAt(earth.periodSeconds);
  near(nextNode.latitudeDeg, 0);
  near(nextNode.longitudeDeg, -360 * earth.periodSeconds / earth.siderealDaySeconds);
});

test('Dans le plan affiché à un même instant, les points forment une orbite fermée qui contient le satellite', () => {
  for (const seconds of [-86400, 834, 6400, 604800]) {
    const start = earth.orbitPointAt(0, seconds);
    const end = earth.orbitPointAt(2 * Math.PI, seconds);
    const satellite = earth.stateAt(seconds);
    const onPath = earth.orbitPointAt(2 * Math.PI * seconds / earth.periodSeconds, seconds);
    near(Math.hypot(satellite.x, satellite.y, satellite.z), 1 + 400 / 6371);
    for (const axis of ['x', 'y', 'z']) {
      near(start[axis], end[axis]);
      near(satellite[axis], onPath[axis]);
    }
  }
});

test('Une entrée non numérique ou non finie produit une erreur exploitable', () => {
  for (const value of [undefined, null, '4', NaN, Infinity]) {
    assert.throws(() => earth.stateAt(value), RangeError);
    assert.throws(() => earth.orbitPointAt(value, 0), RangeError);
    assert.throws(() => earth.orbitPointAt(0, value), RangeError);
  }
});
