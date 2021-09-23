import { getEvenHash } from '../utils';

describe('Utility Tests', () => {
  const dataSet = new Array(94)
    .fill(0)
    .map((v, i) => String.fromCharCode(...new Array(v + i + 1).fill(0).map((v2, i2) => 33 + i2)));

  dataSet.forEach((set) => {
    it(`Creates Even, UnPadded, Hashes For ${set.length} Length Values`, () => {
      let hash!: string;
      expect(() => {
        hash = getEvenHash(set);
      }).not.toThrow();
      expect(hash).toBeDefined();
      expect(hash.length % 4).toEqual(0);
      expect(hash.length).toBeGreaterThan(set.length);
    });
  });
});
