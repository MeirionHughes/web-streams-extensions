import { from, pipe, toArray, concatAll } from './dist/esm/index.js';

async function testEmptyArrays() {
  console.log("Testing empty arrays...");
  
  let input = [[], [1, 2], []];
  console.log("Input:", input);
  
  try {
    let result = await toArray(
      pipe(
        from(input),
        concatAll()
      )
    );
    console.log("Result:", result);
    console.log("Expected: [1, 2]");
  } catch (err) {
    console.error("Error:", err);
  }
}

async function testEmptyStreams() {
  console.log("\nTesting empty streams...");
  
  let input = [from([]), from([1, 2]), from([])];
  console.log("Input: [empty stream, stream of [1,2], empty stream]");
  
  try {
    let result = await toArray(
      pipe(
        from(input),
        concatAll()
      )
    );
    console.log("Result:", result);
    console.log("Expected: [1, 2]");
  } catch (err) {
    console.error("Error:", err);
  }
}

async function testFailingCase() {
  console.log("\nTesting failing case...");
  
  let input = from([[1,2,3], [4,5,6]]);
  console.log("Input: [[1,2,3], [4,5,6]]");
  
  try {
    let result = await toArray(
      pipe(
        input,
        concatAll()
      )
    );
    console.log("Result:", result);
    console.log("Expected: [1, 2, 3, 4, 5, 6]");
  } catch (err) {
    console.error("Error:", err);
  }
}

testEmptyArrays().then(() => testEmptyStreams()).then(() => testFailingCase());
