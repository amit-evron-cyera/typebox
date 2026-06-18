/*--------------------------------------------------------------------------

TypeBox

The MIT License (MIT)

Copyright (c) 2017-2026 Haydn Paterson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

---------------------------------------------------------------------------*/

// deno-fmt-ignore-file

import * as Type from '../../type/index.ts'
import { HasCodec } from './has.ts'
import { FromArray } from './from_array.ts'
import { FromCyclic } from './from_cyclic.ts'
import { FromIntersect } from './from_intersect.ts'
import { FromObject } from './from_object.ts'
import { FromRecord } from './from_record.ts'
import { FromRef } from './from_ref.ts'
import { FromTuple } from './from_tuple.ts'
import { FromUnion } from './from_union.ts'
import { Callback } from './callback.ts'

// ------------------------------------------------------------------
// CodecMemo
//
// Whether a subtree contains a Codec is a property of the (static) schema, not
// the value. The codec walk traverses the value and revisits the same schema
// nodes for every element of an Array, so recomputing HasCodec per visit would
// be O(value). The memo resolves it once per schema node and reuses the result
// for the remainder of the walk.
//
// It is created per DecodeUnsafe/EncodeUnsafe call and threaded through the
// walk (see decode.ts / encode.ts) — call-local, released when the call
// returns, no module state, and reentrancy-safe (a Codec callback that invokes
// Decode/Encode gets its own memo).
// ------------------------------------------------------------------
export type CodecMemo = Map<Type.TSchema, boolean>

function SubtreeHasCodec(memo: CodecMemo, context: Type.TProperties, type: Type.TSchema): boolean {
  let result = memo.get(type)
  if (result === undefined) {
    result = HasCodec(context, type)
    memo.set(type, result)
  }
  return result
}

export function FromType(direction: string, context: Type.TProperties, type: Type.TSchema, value: unknown, memo: CodecMemo): unknown {
  // Prune: a subtree with no Codec is returned by the walk unchanged (the walk
  // only mutates at Codec leaves), so traversing it is pure overhead. Skip it.
  if (!SubtreeHasCodec(memo, context, type)) return value
  return (
    Type.IsArray(type) ? FromArray(direction, context, type, value, memo) :
    Type.IsCyclic(type) ? FromCyclic(direction, context, type, value, memo) :
    Type.IsIntersect(type) ? FromIntersect(direction, context, type, value, memo) :
    Type.IsObject(type) ? FromObject(direction, context, type, value, memo) :
    Type.IsRecord(type) ? FromRecord(direction, context, type, value, memo) :
    Type.IsRef(type) ? FromRef(direction, context, type, value, memo) :
    Type.IsTuple(type) ? FromTuple(direction, context, type, value, memo) :
    Type.IsUnion(type) ? FromUnion(direction, context, type, value, memo) :
    Callback(direction, context, type, value)
  ) as never
}
