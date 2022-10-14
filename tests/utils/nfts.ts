import {
  amount,
  CreatorInput,
  keypairIdentity,
  Metaplex,
  PublicKey,
} from '@metaplex-foundation/js';
import { Connection } from '@solana/web3.js';
import { getKeypair } from './generic';

export const getMetaplexInstance = (conn: Connection) => {
  return Metaplex.make(conn).use(keypairIdentity(getKeypair()));
};

export const mintNfts = async (
  conn: Connection,
  config: {
    numNfts: number;
    recipient?: PublicKey;
    isCollection?: boolean;
    collectionAddress?: PublicKey;
    verifyCollection?: boolean;
    collectionIsSized?: boolean;
    creators?: CreatorInput[];
    sftAmount?: number; // if this is set, will mint sft instread of nft
  },
) => {
  const metaplexInstance = getMetaplexInstance(conn);
  let collectionSigner = (() => {
    if (config.verifyCollection) {
      const kp = getKeypair();
      return { publicKey: kp.publicKey, secretKey: kp.secretKey };
    }
    return undefined;
  })();

  if (config.sftAmount === undefined) {
    return Promise.all(
      Array(0, config.numNfts).map((_, index) =>
        metaplexInstance.nfts().create(
          {
            name: `TEST #${index}`,
            uri: `https://bafybeighhkowmk5ponzoixl2ycv3ihsrshknefc5xxy3eotrfo743x5e3u.ipfs.dweb.link/${index}.json`,
            sellerFeeBasisPoints: 123,
            isCollection: config.isCollection,
            tokenOwner: config.recipient,
            collection: config.collectionAddress,
            collectionAuthority: collectionSigner,
            collectionIsSized: config.collectionIsSized,
            creators: config.creators,
          },
          { confirmOptions: { skipPreflight: true, commitment: 'processed' } },
        ),
      ),
    );
  } else {
    return Promise.all(
      Array(0, config.numNfts).map((_, index) =>
        metaplexInstance.nfts().createSft(
          {
            name: `TEST #${index}`,
            uri: `https://bafybeighhkowmk5ponzoixl2ycv3ihsrshknefc5xxy3eotrfo743x5e3u.ipfs.dweb.link/${index}.json`,
            sellerFeeBasisPoints: 123,
            isCollection: config.isCollection,
            tokenOwner: config.recipient,
            collection: config.collectionAddress,
            collectionAuthority: collectionSigner,
            collectionIsSized: config.collectionIsSized,
            creators: config.creators,
          },
          { confirmOptions: { skipPreflight: true, commitment: 'processed' } },
        ),
      ),
    );
  }
};

export const mintCollection = async (
  conn: Connection,
  config: {
    numNfts: number;
    legacy: boolean;
    recipient?: PublicKey;
    verifyCollection: boolean;
    creators?: CreatorInput[];
  },
) => {
  const collectionNft = (
    await mintNfts(conn, {
      numNfts: 1,
      isCollection: true,
      collectionIsSized: !config.legacy,
    })
  )[0];

  const collectionMembers = await mintNfts(conn, {
    numNfts: config.numNfts,
    recipient: config.recipient,
    collectionAddress: collectionNft.mintAddress,
    verifyCollection: config.verifyCollection,
    creators: config.creators,
  });

  return { collection: collectionNft, members: collectionMembers };
};