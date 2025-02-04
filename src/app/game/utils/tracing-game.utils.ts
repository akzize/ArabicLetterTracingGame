export function getTransformedChunk(
    paths: { x: number; y: number }[][][],
    currentLetterIndex: number,
    currentChunkIndex: number,
    scaleUp: number,
    offsetX: number,
    offsetY: number
): { x: number; y: number }[] {
    // Get current chunk data
    const currentChunk = paths[currentLetterIndex][currentChunkIndex];
    console.log('Current Chunk:', currentChunk);

    // Transform chunk coordinates
    const transformedChunk = currentChunk.map(point => ({
        x: point.x * scaleUp + offsetX,
        y: point.y * scaleUp + offsetY
    }));

    return transformedChunk;
}
