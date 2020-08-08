import { expect } from "chai";
import { toArray, from, pipe, take, skip, concat } from '../src';


  describe("from", () => {
    it("can create stream from array", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.slice();

      let result = await toArray(from(inputA));

      expect(result, "from stream result matches expected").to.be.deep.eq(expected);
    })

    it("can create stream from iterable", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.slice();
      let src = function* () {
        for (let item of inputA) {
          yield item;
        }
      }

      let result = await toArray(from(src()));

      expect(result, "from stream result matches expected").to.be.deep.eq(expected);
    })

    it("can create stream from iterable generator", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.slice();
      let src = function* () {
        for (let item of inputA) {
          yield item;
        }
      }

      let result = await toArray(from(src));

      expect(result, "from stream result matches expected").to.be.deep.eq(expected);
    })

    it("can create stream from async iterable", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.slice();
      let src = async function* () {
        for (let item of inputA) {
          yield item;
        }
      }

      let result = await toArray(from(src()));

      expect(result, "from stream result matches expected").to.be.deep.eq(expected);
    })
    
    it("can create stream from async generator", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.slice();
      let src = async function* () {
        for (let item of inputA) {
          yield item;
        }
      }

      let result = await toArray(from(src));

      expect(result, "from stream result matches expected").to.be.deep.eq(expected);
    })

    it("can create catch error during async iteration ", async () => {
      let inputA = [1, 2, 3, 4];
      let expected = inputA.slice();
      let src = async function* () {
        throw Error("Foo");
      }

      let error = null;

      try {
        let result = await toArray(from(src()));
      } catch (err) {
        error = err;
      }

      expect(error).to.not.be.null;
      expect(error.message).to.be.eq("Foo");
    })   

  })
