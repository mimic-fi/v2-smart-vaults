import { BigNumberish } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, ethers } from 'ethers'
import { defaultAbiCoder, hexValue, hexZeroPad, splitSignature } from 'ethers/lib/utils'

export type FeedData = { base: string; quote: string; rate: BigNumberish; deadline: BigNumberish }

export async function buildExtraFeedData(
  action: Contract,
  feeds: FeedData[],
  signer: SignerWithAddress
): Promise<string> {
  const message = await action.getFeedsDigest(feeds)
  const signature = await signer.signMessage(ethers.utils.arrayify(message))
  const { v, r, s } = splitSignature(signature)
  const encodedV = hexZeroPad(hexValue(v), 32).slice(2)
  const encodedR = r.slice(2)
  const encodedS = s.slice(2)
  const encodedFeeds = encodeFeedsData(feeds)
  return `0x${encodedFeeds}${encodedV}${encodedR}${encodedS}`
}

export function encodeFeedsData(feeds: FeedData[]): string {
  let encodedFeeds = ''
  for (const feed of feeds) encodedFeeds += encodeFeedData(feed)
  return encodedFeeds + defaultAbiCoder.encode(['uint256'], [feeds.length]).slice(2)
}

export function encodeFeedData(feed: FeedData): string {
  return defaultAbiCoder
    .encode(['address', 'address', 'uint256', 'uint256'], [feed.base, feed.quote, feed.rate, feed.deadline])
    .slice(2)
}
