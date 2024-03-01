export function calculateDistanceVec3(
  firstPoint: number[],
  secondPoint: number[],
) {
  return Math.sqrt(
    Math.pow(firstPoint[0] - secondPoint[0], 2) +
      Math.pow(firstPoint[1] - secondPoint[1], 2) +
      Math.pow(firstPoint[2] - secondPoint[2], 2),
  );
}

export function calculateDistanceVec2(
  firstPoint: number[],
  secondPoint: number[],
) {
  return Math.sqrt(
    Math.pow(firstPoint[0] - secondPoint[0], 2) +
      Math.pow(firstPoint[1] - secondPoint[1], 2),
  );
}
