// Auto-generated from contracts/out/. Do not edit by hand.
// Run: pnpm --filter @x502/shared extract-abis

export const bountyVaultAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_usdc",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "_registry",
        "type": "address",
        "internalType": "contract IAgentRegistry"
      },
      {
        "name": "_facts",
        "type": "address",
        "internalType": "contract IGitHubFactProvider"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "agentRegistry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAgentRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "configureRepo",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "trustedAgents",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "threshold",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "prices",
        "type": "tuple",
        "internalType": "struct BountyVault.Prices",
        "components": [
          {
            "name": "report",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "triage",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "fix",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "docsTests",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "outcomeFeePerVerifier",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "domainSeparator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "factProvider",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IGitHubFactProvider"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hashAttestation",
    "inputs": [
      {
        "name": "att",
        "type": "tuple",
        "internalType": "struct Attestations.Attestation",
        "components": [
          {
            "name": "claimId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "recipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "factHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isPaid",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "outcomeFeeOf",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "payout",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "externalId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "enum BountyVault.Kind"
      },
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "factHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "agentIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "signatures",
        "type": "bytes[]",
        "internalType": "bytes[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "priceOf",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "enum BountyVault.Kind"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "repoOwnerOf",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "thresholdOf",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "trustedAgentsOf",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "usdc",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Deposited",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Paid",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "repoId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "kind",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum BountyVault.Kind"
      },
      {
        "name": "recipient",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "agentIds",
        "type": "uint256[]",
        "indexed": false,
        "internalType": "uint256[]"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RepoConfigured",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "threshold",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Withdrawn",
    "inputs": [
      {
        "name": "repoId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyPaid",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "DeadlineExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DuplicateSigner",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "FactHashMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FactNotReady",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientRepoBalance",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientSignatures",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSignature",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "LengthMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotRepoOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PriceUnderflow",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RepoNotConfigured",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "ThresholdZero",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UntrustedAgent",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  }
] as const;

export const bountyVaultBytecode = "0x6101c0604052348015610010575f80fd5b5060405161225838038061225883398101604081905261002f916101c5565b60408051808201825260048152633c1a981960e11b602080830191909152825180840190935260018352603160f81b908301529061006d825f610136565b6101205261007c816001610136565b61014052815160208084019190912060e052815190820120610100524660a05261010860e05161010051604080517f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f60208201529081019290925260608201524660808201523060a08201525f9060c00160405160208183030381529060405280519060200120905090565b60805250503060c05260016002556001600160a01b039283166101605290821661018052166101a0526103b9565b5f6020835110156101515761014a83610168565b9050610162565b8161015c84826102a7565b5060ff90505b92915050565b5f80829050601f8151111561019b578260405163305a27a960e01b81526004016101929190610361565b60405180910390fd5b80516101a682610396565b179392505050565b6001600160a01b03811681146101c2575f80fd5b50565b5f805f606084860312156101d7575f80fd5b83516101e2816101ae565b60208501519093506101f3816101ae565b6040850151909250610204816101ae565b809150509250925092565b634e487b7160e01b5f52604160045260245ffd5b600181811c9082168061023757607f821691505b60208210810361025557634e487b7160e01b5f52602260045260245ffd5b50919050565b601f8211156102a257805f5260205f20601f840160051c810160208510156102805750805b601f840160051c820191505b8181101561029f575f815560010161028c565b50505b505050565b81516001600160401b038111156102c0576102c061020f565b6102d4816102ce8454610223565b8461025b565b6020601f821160018114610306575f83156102ef5750848201515b5f19600385901b1c1916600184901b17845561029f565b5f84815260208120601f198516915b828110156103355787850151825560209485019460019092019101610315565b508482101561035257868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b80516020808301519190811015610255575f1960209190910360031b1b16919050565b60805160a05160c05160e05161010051610120516101405161016051610180516101a051611dff6104595f395f818161022a01526107e701525f818161013301528181610a09015261109601525f81816101e3015281816103d00152818161049501528181610ab80152610b0c01525f610f7001525f610f4401525f61128f01525f61126701525f6111c201525f6111ec01525f6112160152611dff5ff3fe608060405234801561000f575f80fd5b5060043610610115575f3560e01c80636c7f1542116100ad57806399ac92c11161007d578063db7dc80911610063578063db7dc809146102f9578063f698da251461030c578063feef664014610314575f80fd5b806399ac92c1146102be578063af89e39f146102d1575f80fd5b80636c7f15421461024c5780637f627f811461026e57806384b0196e146102815780638928735b1461029c575f80fd5b8063324b8e65116100e8578063324b8e65146101bd5780633e413bee146101de578063447ec2751461020557806363c326f014610225575f80fd5b8063040cf020146101195780630d1cfcae1461012e5780631795ba80146101725780631de26e16146101aa575b5f80fd5b61012c6101273660046117a6565b610346565b005b6101557f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b0390911681526020015b60405180910390f35b6101986101803660046117c6565b5f908152600360208190526040909120015460ff1690565b60405160ff9091168152602001610169565b61012c6101b83660046117a6565b61043d565b6101d06101cb366004611839565b6104f9565b604051908152602001610169565b6101557f000000000000000000000000000000000000000000000000000000000000000081565b6102186102133660046117c6565b610511565b60405161016991906118df565b6101557f000000000000000000000000000000000000000000000000000000000000000081565b6101d061025a3660046117c6565b5f9081526003602052604090206001015490565b6101d061027c366004611904565b610573565b610289610591565b604051610169979695949392919061195c565b6101d06102aa3660046117c6565b5f9081526003602052604090206008015490565b61012c6102cc366004611a2d565b6105ef565b6101556102df3660046117c6565b5f908152600360205260409020546001600160a01b031690565b61012c610307366004611ae7565b610b96565b6101d0610ced565b6103366103223660046117c6565b60046020525f908152604090205460ff1681565b6040519015158152602001610169565b61034e610cfb565b5f82815260036020526040902080546001600160a01b0316331461038557604051637735d60b60e01b815260040160405180910390fd5b81816001015410156103aa5760405163822eeced60e01b815260040160405180910390fd5b81816001015f8282546103bd9190611b81565b909155506103f790506001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000163384610d3c565b604051828152339084907f04eda370f8b8612fa7266d7ebbd41af9d694e19793fe9d9ff31b3ddbd99b08e19060200160405180910390a3506104396001600255565b5050565b5f828152600360205260409020600981015460ff1661046f57604051632c32c26f60e01b815260040160405180910390fd5b81816001015f8282546104829190611b94565b909155506104bd90506001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016333085610db5565b604051828152339084907f87d4c0b5e30d6808bc8a94ba1c4d839b29d664151551a31753387ee9ef48429b9060200160405180910390a3505050565b5f61050b61050683610df4565b610e81565b92915050565b5f8181526003602090815260409182902060020180548351818402810184019094528084526060939283018282801561056757602002820191905f5260205f20905b815481526020019060010190808311610553575b50505050509050919050565b5f82815260036020526040812061058a9083610ec8565b9392505050565b5f6060805f805f60606105a2610f3d565b6105aa610f69565b604080515f808252602082019092527f0f000000000000000000000000000000000000000000000000000000000000009b939a50919850469750309650945092509050565b6105f7610cfb565b85421115610631576040517f1ab7da6b00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82811461066a576040517fff633a3800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f8a8152600360205260409020600981015460ff1661069c57604051632c32c26f60e01b815260040160405180910390fd5b600381015460ff168410156106dd576040517f6e49c68600000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6040805160a0810182525f808252602082018190526060928201839052918101829052608081019190915261075d8c8c8c600381111561071f5761071f611ba7565b604080516020810185905290810183905260ff821660608201525f906080016040516020818303038152906040528051906020012090509392505050565b8082525f9081526004602052604090205460ff16156107b35780516040517ff4b76a0e00000000000000000000000000000000000000000000000000000000815260048101919091526024015b60405180910390fd5b80516040517f8ddec1f50000000000000000000000000000000000000000000000000000000081525f916001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001691638ddec1f59161081e9160040190815260200190565b5f60405180830381865afa158015610838573d5f803e3d5ffd5b505050506040513d5f823e601f3d908101601f1916820160405261085f9190810190611bbb565b604084015290508061089d576040517fa1d03ed100000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b87826040015180519060200120146108e1576040517fe5fedfae00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6109166040518060800160405280845f015181526020018c6001600160a01b031681526020018b81526020018a8152506104f9565b82602001818152505061093183888888888760200151610f96565b5f61093c848d610ec8565b600885015490915061094f908890611c67565b60608401819052811161098e576040517f7dacea9600000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b606083015161099d9082611b81565b608084015260018401548111156109c75760405163822eeced60e01b815260040160405180910390fd5b82515f908152600460205260408120805460ff19166001908117909155850180548392906109f6908490611b81565b909155505f90505b87811015610af8575f7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316623395098b8b85818110610a4757610a47611c7e565b905060200201356040518263ffffffff1660e01b8152600401610a6c91815260200190565b602060405180830381865afa158015610a87573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610aab9190611c92565b9050610aef8187600801547f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316610d3c9092919063ffffffff16565b506001016109fe565b506080830151610b34906001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016908d90610d3c565b8d835f01517fa6bcce85215ad3fedf98df76b29550797e243568e8a84275a197098b105e3bd38e8e87608001518d8d604051610b74959493929190611cad565b60405180910390a350505050610b8a6001600255565b50505050505050505050565b5f868152600360205260409020600981015460ff1615610bdf5780546001600160a01b03163314610bda57604051637735d60b60e01b815260040160405180910390fd5b610c17565b80547fffffffffffffffffffffffff0000000000000000000000000000000000000000163317815560098101805460ff191660011790555b8360ff165f03610c53576040517f9dd75d7900000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b610c61600282018787611749565b5060038101805460ff191660ff8616908117909155833560048301556020808501356005840155604080860135600685015560608601356007850155600884018590558354815193845290516001600160a01b03909116928a927f6f9d652e4404079a96c378a56c6daca76446bd8122dfe4c5a3722d3d00d191a292918290030190a350505050505050565b5f610cf66111b6565b905090565b6002805403610d36576040517f3ee5aeb500000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60028055565b6040516001600160a01b03838116602483015260448201839052610db091859182169063a9059cbb906064015b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff83818316178352505050506112df565b505050565b6040516001600160a01b038481166024830152838116604483015260648201839052610dee9186918216906323b872dd90608401610d69565b50505050565b5f7ffebc69c0af6cc8001c8071884a4b0a4c1ff385d318f1ba22fdcd2d77dbb996de825f0151836020015184604001518560600151604051602001610e6495949392919094855260208501939093526001600160a01b039190911660408401526060830152608082015260a00190565b604051602081830303815290604052805190602001209050919050565b5f61050b610e8d6111b6565b836040517f19010000000000000000000000000000000000000000000000000000000000008152600281019290925260228201526042902090565b5f80826003811115610edc57610edc611ba7565b03610eec5750600482015461050b565b6001826003811115610f0057610f00611ba7565b03610f105750600582015461050b565b6002826003811115610f2457610f24611ba7565b03610f345750600682015461050b565b50506007015490565b6060610cf67f00000000000000000000000000000000000000000000000000000000000000005f611364565b6060610cf67f00000000000000000000000000000000000000000000000000000000000000006001611364565b5f5b848110156111ad575f868683818110610fb357610fb3611c7e565b9050602002013590505f5b828110156110225781888883818110610fd957610fd9611c7e565b905060200201350361101a576040517f9f4f72e1000000000000000000000000000000000000000000000000000000008152600481018390526024016107aa565b600101610fbe565b5061102d888261140d565b611066576040517fb7ebdde5000000000000000000000000000000000000000000000000000000008152600481018290526024016107aa565b6040517e339509000000000000000000000000000000000000000000000000000000008152600481018290525f907f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316906233950990602401602060405180830381865afa1580156110e2573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906111069190611c92565b905061116a818588888781811061111f5761111f611c7e565b90506020028101906111319190611d37565b8080601f0160208091040260200160405190810160405280939291908181526020018383808284375f9201919091525061145f92505050565b6111a3576040517f52bf9848000000000000000000000000000000000000000000000000000000008152600481018390526024016107aa565b5050600101610f98565b50505050505050565b5f306001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614801561120e57507f000000000000000000000000000000000000000000000000000000000000000046145b1561123857507f000000000000000000000000000000000000000000000000000000000000000090565b610cf6604080517f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f60208201527f0000000000000000000000000000000000000000000000000000000000000000918101919091527f000000000000000000000000000000000000000000000000000000000000000060608201524660808201523060a08201525f9060c00160405160208183030381529060405280519060200120905090565b5f8060205f8451602086015f885af1806112fe576040513d5f823e3d81fd5b50505f513d91508115611315578060011415611322565b6001600160a01b0384163b155b15610dee576040517f5274afe70000000000000000000000000000000000000000000000000000000081526001600160a01b03851660048201526024016107aa565b606060ff831461137e57611377836114cf565b905061050b565b81805461138a90611d7a565b80601f01602080910402602001604051908101604052809291908181526020018280546113b690611d7a565b80156114015780601f106113d857610100808354040283529160200191611401565b820191905f5260205f20905b8154815290600101906020018083116113e457829003601f168201915b5050505050905061050b565b60028201545f90815b81811015611455578385600201828154811061143457611434611c7e565b905f5260205f2001540361144d5760019250505061050b565b600101611416565b505f949350505050565b5f836001600160a01b03163b5f036114bd575f8061147d858561150c565b5090925090505f81600381111561149657611496611ba7565b1480156114b45750856001600160a01b0316826001600160a01b0316145b9250505061058a565b6114c8848484611555565b905061058a565b60605f6114db83611641565b6040805160208082528183019092529192505f91906020820181803683375050509182525060208101929092525090565b5f805f8351604103611543576020840151604085015160608601515f1a61153588828585611681565b95509550955050505061154e565b505081515f91506002905b9250925092565b5f805f856001600160a01b03168585604051602401611575929190611db2565b60408051601f198184030181529181526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff16630b135d3f60e11b179052516115bf9190611dd2565b5f60405180830381855afa9150503d805f81146115f7576040519150601f19603f3d011682016040523d82523d5f602084013e6115fc565b606091505b509150915081801561161057506020815110155b801561163757508051630b135d3f60e11b906116359083016020908101908401611de8565b145b9695505050505050565b5f60ff8216601f81111561050b576040517fb3512b0c00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f80807f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a08411156116ba57505f9150600390508261173f565b604080515f808252602082018084528a905260ff891692820192909252606081018790526080810186905260019060a0016020604051602081039080840390855afa15801561170b573d5f803e3d5ffd5b5050604051601f1901519150506001600160a01b03811661173657505f92506001915082905061173f565b92505f91508190505b9450945094915050565b828054828255905f5260205f20908101928215611782579160200282015b82811115611782578235825591602001919060010190611767565b5061178e929150611792565b5090565b5b8082111561178e575f8155600101611793565b5f80604083850312156117b7575f80fd5b50508035926020909101359150565b5f602082840312156117d6575f80fd5b5035919050565b634e487b7160e01b5f52604160045260245ffd5b604051601f8201601f1916810167ffffffffffffffff8111828210171561181a5761181a6117dd565b604052919050565b6001600160a01b0381168114611836575f80fd5b50565b5f608082840312801561184a575f80fd5b506040516080810167ffffffffffffffff8111828210171561186e5761186e6117dd565b60405282358152602083013561188381611822565b6020820152604083810135908201526060928301359281019290925250919050565b5f8151808452602084019350602083015f5b828110156118d55781518652602095860195909101906001016118b7565b5093949350505050565b602081525f61058a60208301846118a5565b8035600481106118ff575f80fd5b919050565b5f8060408385031215611915575f80fd5b82359150611925602084016118f1565b90509250929050565b5f81518084528060208401602086015e5f602082860101526020601f19601f83011685010191505092915050565b7fff000000000000000000000000000000000000000000000000000000000000008816815260e060208201525f61199660e083018961192e565b82810360408401526119a8818961192e565b90508660608401526001600160a01b03861660808401528460a084015282810360c08401526119d781856118a5565b9a9950505050505050505050565b5f8083601f8401126119f5575f80fd5b50813567ffffffffffffffff811115611a0c575f80fd5b6020830191508360208260051b8501011115611a26575f80fd5b9250929050565b5f805f805f805f805f806101008b8d031215611a47575f80fd5b8a35995060208b01359850611a5e60408c016118f1565b975060608b0135611a6e81611822565b965060808b0135955060a08b0135945060c08b013567ffffffffffffffff811115611a97575f80fd5b611aa38d828e016119e5565b90955093505060e08b013567ffffffffffffffff811115611ac2575f80fd5b611ace8d828e016119e5565b915080935050809150509295989b9194979a5092959850565b5f805f805f80868803610100811215611afe575f80fd5b87359650602088013567ffffffffffffffff811115611b1b575f80fd5b611b278a828b016119e5565b909750955050604088013560ff81168114611b40575f80fd5b93506080605f1982011215611b53575f80fd5b5094979396509194909350606081019260e0909101359150565b634e487b7160e01b5f52601160045260245ffd5b8181038181111561050b5761050b611b6d565b8082018082111561050b5761050b611b6d565b634e487b7160e01b5f52602160045260245ffd5b5f8060408385031215611bcc575f80fd5b82518015158114611bdb575f80fd5b602084015190925067ffffffffffffffff811115611bf7575f80fd5b8301601f81018513611c07575f80fd5b805167ffffffffffffffff811115611c2157611c216117dd565b611c34601f8201601f19166020016117f1565b818152866020838501011115611c48575f80fd5b8160208401602083015e5f602083830101528093505050509250929050565b808202811582820484141761050b5761050b611b6d565b634e487b7160e01b5f52603260045260245ffd5b5f60208284031215611ca2575f80fd5b815161058a81611822565b5f60048710611cca57634e487b7160e01b5f52602160045260245ffd5b8682526001600160a01b0386166020830152846040830152608060608301528260808301527f07ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff831115611d1b575f80fd5b8260051b808560a08501379190910160a0019695505050505050565b5f808335601e19843603018112611d4c575f80fd5b83018035915067ffffffffffffffff821115611d66575f80fd5b602001915036819003821315611a26575f80fd5b600181811c90821680611d8e57607f821691505b602082108103611dac57634e487b7160e01b5f52602260045260245ffd5b50919050565b828152604060208201525f611dca604083018461192e565b949350505050565b5f82518060208501845e5f920191825250919050565b5f60208284031215611df8575f80fd5b505191905056" as `0x${string}`;

export const gitHubFactReceiverAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "router_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "authorizer",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimIdOfRequest",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "config",
    "inputs": [],
    "outputs": [
      {
        "name": "subscriptionId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "callbackGasLimit",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "donId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "secretsSlotId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "secretsVersion",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getFact",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "ready",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "factBlob",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "handleOracleFulfillment",
    "inputs": [
      {
        "name": "requestId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "response",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "err",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requestFact",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "repo",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "externalId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "requestId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "requestIdOf",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setAuthorizer",
    "inputs": [
      {
        "name": "newAuthorizer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setConfig",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "callbackGasLimit",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "donId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "secretsSlotId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "secretsVersion",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setSource",
    "inputs": [
      {
        "name": "src",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "source",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "AuthorizerSet",
    "inputs": [
      {
        "name": "authorizer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ConfigUpdated",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "donId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "callbackGasLimit",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FactFulfilled",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "requestId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "factBlob",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      },
      {
        "name": "err",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RequestFulfilled",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RequestSent",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SourceUpdated",
    "inputs": [
      {
        "name": "sourceLen",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "EmptyArgs",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EmptySource",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoInlineSecrets",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAuthorizer",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OnlyRouterCanFulfill",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnknownRequest",
    "inputs": []
  }
] as const;

export const gitHubFactReceiverBytecode = "0x60a060405234801561000f575f80fd5b50604051611ebe380380611ebe83398101604081905261002e916100db565b6001600160a01b038083166080525f80549183166001600160a01b0319928316811782556001805490931681179092556040517f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908290a36040516001600160a01b038216907fb251079a3e59729d2256949e48e44b7959908cdf34789078b6a1462ec3276720905f90a2505061010c565b80516001600160a01b03811681146100d6575f80fd5b919050565b5f80604083850312156100ec575f80fd5b6100f5836100c0565b9150610103602084016100c0565b90509250929050565b608051611d9361012b5f395f818161031c015261103d0152611d935ff3fe608060405234801561000f575f80fd5b50600436106100da575f3560e01c806379502c551161008857806399bb40941161006357806399bb40941461023957806399d2545514610258578063d09edf311461026b578063f2fde38b1461027e575f80fd5b806379502c55146101735780638da5cb5b146101ee5780638ddec1f514610218575f80fd5b806321bf35f5116100b857806321bf35f51461013857806337e5952f1461014b57806367e828bf1461015e575f80fd5b8063058a628f146100de5780630ca76175146100f357806316bfdcdc14610106575b5f80fd5b6100f16100ec366004611648565b610291565b005b6100f161010136600461170d565b610311565b61012561011436600461177a565b60086020525f908152604090205481565b6040519081526020015b60405180910390f35b6100f16101463660046117bd565b6103ad565b610125610159366004611866565b6104a9565b610166610741565b60405161012f91906118ea565b6003546004546005546101b09267ffffffffffffffff808216936801000000000000000090920463ffffffff169260ff8116916101009091041685565b6040805167ffffffffffffffff968716815263ffffffff909516602086015284019290925260ff16606083015291909116608082015260a00161012f565b5f54610200906001600160a01b031681565b6040516001600160a01b03909116815260200161012f565b61022b61022636600461177a565b6107cd565b60405161012f9291906118fc565b61012561024736600461177a565b60076020525f908152604090205481565b6100f1610266366004611916565b61089d565b600154610200906001600160a01b031681565b6100f161028c366004611648565b61090c565b5f546001600160a01b031633146102bb576040516330cd747160e01b815260040160405180910390fd5b6001805473ffffffffffffffffffffffffffffffffffffffff19166001600160a01b0383169081179091556040517fb251079a3e59729d2256949e48e44b7959908cdf34789078b6a1462ec3276720905f90a250565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610373576040517fc6829f8300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b61037e83838361099c565b60405183907f85e1543bf2f84fe80c6badbce3648c8539ad1df4d2b3d822938ca0538be727e6905f90a2505050565b5f546001600160a01b031633146103d7576040516330cd747160e01b815260040160405180910390fd5b6040805160a08101825267ffffffffffffffff87811680835263ffffffff8816602080850182905284860189905260ff881660608087018290529488166080909601869052600380546bffffffffffffffffffffffff1916851768010000000000000000850217905560048a90556005805468ffffffffffffffffff1916909117610100909602959095179094558451918252928101879052928301919091527fada7c059d03027c2d19603401220dcab0db47516c3cb26f0ee1218a123b1548f910160405180910390a15050505050565b6001545f906001600160a01b031633146104ef576040517f9e5c42e800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b61052d6040805160e08101909152805f81526020015f81526020015f8152602001606081526020016060815260200160608152602001606081525090565b6105c86002805461053d90611955565b80601f016020809104026020016040519081016040528092919081815260200182805461056990611955565b80156105b45780601f1061058b576101008083540402835291602001916105b4565b820191905f5260205f20905b81548152906001019060200180831161059757829003601f168201915b505050505082610a8190919063ffffffff16565b600554610100900467ffffffffffffffff16156106015760055461060190829060ff811690610100900467ffffffffffffffff16610a91565b604080516003808252608082019092525f91816020015b606081526020019060019003908161061857905050905086868080601f0160208091040260200160405190810160405280939291908181526020018383808284375f9201829052508551869450909250151590506106785761067861198d565b602002602001018190525061068c85610b53565b8160018151811061069f5761069f61198d565b60200260200101819052506106b68460ff16610b53565b816002815181106106c9576106c961198d565b60209081029190910101526106de8282610c8c565b6107146106ea83610cce565b60035460045467ffffffffffffffff82169168010000000000000000900463ffffffff1690611039565b5f898152600760209081526040808320849055838352600890915290209890985550959695505050505050565b6002805461074e90611955565b80601f016020809104026020016040519081016040528092919081815260200182805461077a90611955565b80156107c55780601f1061079c576101008083540402835291602001916107c5565b820191905f5260205f20905b8154815290600101906020018083116107a857829003601f168201915b505050505081565b5f8181526006602090815260408083208151808301909252805460ff1615158252600181018054606094869493929084019161080890611955565b80601f016020809104026020016040519081016040528092919081815260200182805461083490611955565b801561087f5780601f106108565761010080835404028352916020019161087f565b820191905f5260205f20905b81548152906001019060200180831161086257829003601f168201915b5050505050815250509050805f015181602001519250925050915091565b5f546001600160a01b031633146108c7576040516330cd747160e01b815260040160405180910390fd5b60026108d48284836119ec565b506040518181527f0e7cd0cf40501b9611b706a4ef8b94345fdce2b642230cf2496856c3f4f4b6199060200160405180910390a15050565b5f546001600160a01b03163314610936576040516330cd747160e01b815260040160405180910390fd5b5f80546040516001600160a01b03808516939216917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e091a35f805473ffffffffffffffffffffffffffffffffffffffff19166001600160a01b0392909216919091179055565b5f83815260086020526040902054806109e1576040517f6d08029700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f84815260086020526040812081905582519003610a4057604080518082018252600180825260208083018781525f86815260069092529390208251815460ff1916901515178155925191929190820190610a3c9082611aa6565b5050505b83817fc6ad68e0a531a5774430d3558ac7019fe19d8162a41a5dda0c2930f23e413a268585604051610a73929190611b61565b60405180910390a350505050565b610a8d825f8084611106565b5050565b5f610a9d61010061119c565b9050610ae76040518060400160405280600681526020017f736c6f7449440000000000000000000000000000000000000000000000000000815250826111bc90919063ffffffff16565b610af48160ff85166111da565b60408051808201909152600781527f76657273696f6e000000000000000000000000000000000000000000000000006020820152610b339082906111bc565b610b3d81836111da565b6002602085015251516080909301929092525050565b6060815f03610b9557505060408051808201909152600181527f3000000000000000000000000000000000000000000000000000000000000000602082015290565b815f5b8115610bbe5780610ba881611bb6565b9150610bb79050600a83611be2565b9150610b98565b5f8167ffffffffffffffff811115610bd857610bd861166e565b6040519080825280601f01601f191660200182016040528015610c02576020820181803683370190505b5090505b8415610c8457610c17600183611bf5565b9150610c24600a86611c08565b610c2f906030611c1b565b60f81b818381518110610c4457610c4461198d565b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff191690815f1a905350610c7d600a86611be2565b9450610c06565b949350505050565b80515f03610cc6576040517ffe936cb700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60a090910152565b60605f610cdc61010061119c565b9050610d266040518060400160405280600c81526020017f636f64654c6f636174696f6e0000000000000000000000000000000000000000815250826111bc90919063ffffffff16565b8251610d44906002811115610d3d57610d3d611b8e565b82906111e5565b60408051808201909152600881527f6c616e67756167650000000000000000000000000000000000000000000000006020820152610d839082906111bc565b6040830151610d9a908015610d3d57610d3d611b8e565b60408051808201909152600681527f736f7572636500000000000000000000000000000000000000000000000000006020820152610dd99082906111bc565b6060830151610de99082906111bc565b60a08301515115610e8d5760408051808201909152600481527f61726773000000000000000000000000000000000000000000000000000000006020820152610e339082906111bc565b610e3c8161121e565b5f5b8360a0015151811015610e8357610e7b8460a001518281518110610e6457610e6461198d565b6020026020010151836111bc90919063ffffffff16565b600101610e3e565b50610e8d81611242565b60808301515115610f8d575f83602001516002811115610eaf57610eaf611b8e565b03610ee6576040517fa80d31f700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60408051808201909152600f81527f736563726574734c6f636174696f6e00000000000000000000000000000000006020820152610f259082906111bc565b610f3e83602001516002811115610d3d57610d3d611b8e565b60408051808201909152600781527f73656372657473000000000000000000000000000000000000000000000000006020820152610f7d9082906111bc565b6080830151610f8d908290611260565b60c083015151156110315760408051808201909152600981527f62797465734172677300000000000000000000000000000000000000000000006020820152610fd79082906111bc565b610fe08161121e565b5f5b8360c00151518110156110275761101f8460c0015182815181106110085761100861198d565b60200260200101518361126090919063ffffffff16565b600101610fe2565b5061103181611242565b515192915050565b5f807f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663461d27628688600188886040518663ffffffff1660e01b8152600401611090959493929190611c2e565b6020604051808303815f875af11580156110ac573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906110d09190611c77565b60405190915081907f1131472297a800fee664d1d89cfa8f7676ff07189ecc53f80bbb5f4969099db8905f90a295945050505050565b80515f03611140576040517f22ce3edd00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8383600281111561115357611153611b8e565b9081600281111561116657611166611b8e565b9052506040840182801561117c5761117c611b8e565b9081801561118c5761118c611b8e565b9052506060909301929092525050565b6111a4611615565b80516111b0908361126d565b505f6020820152919050565b6111c982600383516112e4565b81516111d5908261140b565b505050565b610a8d825f836112e4565b81516111f29060c2611432565b50610a8d828260405160200161120a91815260200190565b604051602081830303815290604052611260565b611229816004611499565b60018160200181815161123c9190611c1b565b90525050565b61124d816007611499565b60018160200181815161123c9190611bf5565b6111c982600283516112e4565b60408051808201909152606081525f602082015261128c602083611c08565b156112b45761129c602083611c08565b6112a7906020611bf5565b6112b19083611c1b565b91505b60208084018390526040518085525f81529081840101818110156112d6575f80fd5b604052508290505b92915050565b60178167ffffffffffffffff161161131157825161130b9060e0600585901b168317611432565b50505050565b60ff8167ffffffffffffffff161161135357825161133a906018611fe0600586901b1617611432565b50825161130b9067ffffffffffffffff831660016114b0565b61ffff8167ffffffffffffffff161161139657825161137d906019611fe0600586901b1617611432565b50825161130b9067ffffffffffffffff831660026114b0565b63ffffffff8167ffffffffffffffff16116113db5782516113c290601a611fe0600586901b1617611432565b50825161130b9067ffffffffffffffff831660046114b0565b82516113f290601b611fe0600586901b1617611432565b50825161130b9067ffffffffffffffff831660086114b0565b60408051808201909152606081525f602082015261142b83838451611532565b9392505050565b60408051808201909152606081525f60208201528251515f611455826001611c1b565b9050846020015182106114765761147685611471836002611c8e565b6115fe565b845160208382010185815350805182111561148f578181525b5093949350505050565b81516111d590601f611fe0600585901b1617611432565b60408051808201909152606081525f60208201528351515f6114d28285611c1b565b905085602001518111156114ef576114ef86611471836002611c8e565b5f60016114fe86610100611d88565b6115089190611bf5565b90508651828101878319825116178152508051831115611526578281525b50959695505050505050565b60408051808201909152606081525f60208201528251821115611553575f80fd5b8351515f6115618483611c1b565b9050856020015181111561157e5761157e86611471836002611c8e565b85518051838201602001915f9180851115611597578482525b505050602086015b602086106115d757805182526115b6602083611c1b565b91506115c3602082611c1b565b90506115d0602087611bf5565b955061159f565b5181515f1960208890036101000a0190811690199190911617905250849150509392505050565b815161160a838361126d565b5061130b838261140b565b604051806040016040528061163c6040518060400160405280606081526020015f81525090565b81526020015f81525090565b5f60208284031215611658575f80fd5b81356001600160a01b038116811461142b575f80fd5b634e487b7160e01b5f52604160045260245ffd5b5f82601f830112611691575f80fd5b813567ffffffffffffffff8111156116ab576116ab61166e565b604051601f8201601f19908116603f0116810167ffffffffffffffff811182821017156116da576116da61166e565b6040528181528382016020018510156116f1575f80fd5b816020850160208301375f918101602001919091529392505050565b5f805f6060848603121561171f575f80fd5b83359250602084013567ffffffffffffffff81111561173c575f80fd5b61174886828701611682565b925050604084013567ffffffffffffffff811115611764575f80fd5b61177086828701611682565b9150509250925092565b5f6020828403121561178a575f80fd5b5035919050565b803567ffffffffffffffff811681146117a8575f80fd5b919050565b803560ff811681146117a8575f80fd5b5f805f805f60a086880312156117d1575f80fd5b6117da86611791565b9450602086013563ffffffff811681146117f2575f80fd5b935060408601359250611807606087016117ad565b915061181560808701611791565b90509295509295909350565b5f8083601f840112611831575f80fd5b50813567ffffffffffffffff811115611848575f80fd5b60208301915083602082850101111561185f575f80fd5b9250929050565b5f805f805f6080868803121561187a575f80fd5b85359450602086013567ffffffffffffffff811115611897575f80fd5b6118a388828901611821565b90955093505060408601359150611815606087016117ad565b5f81518084528060208401602086015e5f602082860101526020601f19601f83011685010191505092915050565b602081525f61142b60208301846118bc565b8215158152604060208201525f610c8460408301846118bc565b5f8060208385031215611927575f80fd5b823567ffffffffffffffff81111561193d575f80fd5b61194985828601611821565b90969095509350505050565b600181811c9082168061196957607f821691505b60208210810361198757634e487b7160e01b5f52602260045260245ffd5b50919050565b634e487b7160e01b5f52603260045260245ffd5b601f8211156111d557805f5260205f20601f840160051c810160208510156119c65750805b601f840160051c820191505b818110156119e5575f81556001016119d2565b5050505050565b67ffffffffffffffff831115611a0457611a0461166e565b611a1883611a128354611955565b836119a1565b5f601f841160018114611a49575f8515611a325750838201355b5f19600387901b1c1916600186901b1783556119e5565b5f83815260208120601f198716915b82811015611a785786850135825560209485019460019092019101611a58565b5086821015611a94575f1960f88860031b161c19848701351681555b505060018560011b0183555050505050565b815167ffffffffffffffff811115611ac057611ac061166e565b611ad481611ace8454611955565b846119a1565b6020601f821160018114611b06575f8315611aef5750848201515b5f19600385901b1c1916600184901b1784556119e5565b5f84815260208120601f198516915b82811015611b355787850151825560209485019460019092019101611b15565b5084821015611b5257868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b604081525f611b7360408301856118bc565b8281036020840152611b8581856118bc565b95945050505050565b634e487b7160e01b5f52602160045260245ffd5b634e487b7160e01b5f52601160045260245ffd5b5f60018201611bc757611bc7611ba2565b5060010190565b634e487b7160e01b5f52601260045260245ffd5b5f82611bf057611bf0611bce565b500490565b818103818111156112de576112de611ba2565b5f82611c1657611c16611bce565b500690565b808201808211156112de576112de611ba2565b67ffffffffffffffff8616815260a060208201525f611c5060a08301876118bc565b61ffff9590951660408301525063ffffffff92909216606083015260809091015292915050565b5f60208284031215611c87575f80fd5b5051919050565b80820281158282048414176112de576112de611ba2565b6001815b6001841115611ce057808504811115611cc457611cc4611ba2565b6001841615611cd257908102905b60019390931c928002611ca9565b935093915050565b5f82611cf6575060016112de565b81611d0257505f6112de565b8160018114611d185760028114611d2257611d3e565b60019150506112de565b60ff841115611d3357611d33611ba2565b50506001821b6112de565b5060208310610133831016604e8410600b8410161715611d61575081810a6112de565b611d6d5f198484611ca5565b805f1904821115611d8057611d80611ba2565b029392505050565b5f61142b8383611ce856" as `0x${string}`;

export const mockUSDCAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "mint",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ERC20InsufficientAllowance",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InsufficientBalance",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidApprover",
    "inputs": [
      {
        "name": "approver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidReceiver",
    "inputs": [
      {
        "name": "receiver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSender",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSpender",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ]
  }
] as const;

export const mockUSDCBytecode = "0x608060405234801561000f575f80fd5b506040518060400160405280600f81526020016e55534420436f696e20286d6f636b2960881b815250604051806040016040528060048152602001635553444360e01b81525081600390816100649190610111565b5060046100718282610111565b5050506101cb565b634e487b7160e01b5f52604160045260245ffd5b600181811c908216806100a157607f821691505b6020821081036100bf57634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561010c57805f5260205f20601f840160051c810160208510156100ea5750805b601f840160051c820191505b81811015610109575f81556001016100f6565b50505b505050565b81516001600160401b0381111561012a5761012a610079565b61013e81610138845461008d565b846100c5565b6020601f821160018114610170575f83156101595750848201515b5f19600385901b1c1916600184901b178455610109565b5f84815260208120601f198516915b8281101561019f578785015182556020948501946001909201910161017f565b50848210156101bc57868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b6107ab806101d85f395ff3fe608060405234801561000f575f80fd5b50600436106100b9575f3560e01c806340c10f191161007257806395d89b411161005857806395d89b411461016f578063a9059cbb14610177578063dd62ed3e1461018a575f80fd5b806340c10f191461013257806370a0823114610147575f80fd5b806318160ddd116100a257806318160ddd146100fe57806323b872dd14610110578063313ce56714610123575f80fd5b806306fdde03146100bd578063095ea7b3146100db575b5f80fd5b6100c56101c2565b6040516100d29190610651565b60405180910390f35b6100ee6100e93660046106a1565b610252565b60405190151581526020016100d2565b6002545b6040519081526020016100d2565b6100ee61011e3660046106c9565b61026b565b604051600681526020016100d2565b6101456101403660046106a1565b61028e565b005b610102610155366004610703565b6001600160a01b03165f9081526020819052604090205490565b6100c561029c565b6100ee6101853660046106a1565b6102ab565b610102610198366004610723565b6001600160a01b039182165f90815260016020908152604080832093909416825291909152205490565b6060600380546101d190610754565b80601f01602080910402602001604051908101604052809291908181526020018280546101fd90610754565b80156102485780601f1061021f57610100808354040283529160200191610248565b820191905f5260205f20905b81548152906001019060200180831161022b57829003601f168201915b5050505050905090565b5f3361025f8185856102b8565b60019150505b92915050565b5f336102788582856102ca565b610283858585610364565b506001949350505050565b61029882826103da565b5050565b6060600480546101d190610754565b5f3361025f818585610364565b6102c5838383600161040e565b505050565b6001600160a01b038381165f908152600160209081526040808320938616835292905220545f1981101561035e5781811015610350576040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526001600160a01b038416600482015260248101829052604481018390526064015b60405180910390fd5b61035e84848484035f61040e565b50505050565b6001600160a01b0383166103a6576040517f96c6fd1e0000000000000000000000000000000000000000000000000000000081525f6004820152602401610347565b6001600160a01b0382166103cf5760405163ec442f0560e01b81525f6004820152602401610347565b6102c5838383610512565b6001600160a01b0382166104035760405163ec442f0560e01b81525f6004820152602401610347565b6102985f8383610512565b6001600160a01b038416610450576040517fe602df050000000000000000000000000000000000000000000000000000000081525f6004820152602401610347565b6001600160a01b038316610492576040517f94280d620000000000000000000000000000000000000000000000000000000081525f6004820152602401610347565b6001600160a01b038085165f908152600160209081526040808320938716835292905220829055801561035e57826001600160a01b0316846001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9258460405161050491815260200190565b60405180910390a350505050565b6001600160a01b03831661053c578060025f828254610531919061078c565b909155506105c59050565b6001600160a01b0383165f90815260208190526040902054818110156105a7576040517fe450d38c0000000000000000000000000000000000000000000000000000000081526001600160a01b03851660048201526024810182905260448101839052606401610347565b6001600160a01b0384165f9081526020819052604090209082900390555b6001600160a01b0382166105e1576002805482900390556105ff565b6001600160a01b0382165f9081526020819052604090208054820190555b816001600160a01b0316836001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161064491815260200190565b60405180910390a3505050565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b80356001600160a01b038116811461069c575f80fd5b919050565b5f80604083850312156106b2575f80fd5b6106bb83610686565b946020939093013593505050565b5f805f606084860312156106db575f80fd5b6106e484610686565b92506106f260208501610686565b929592945050506040919091013590565b5f60208284031215610713575f80fd5b61071c82610686565b9392505050565b5f8060408385031215610734575f80fd5b61073d83610686565b915061074b60208401610686565b90509250929050565b600181811c9082168061076857607f821691505b60208210810361078657634e487b7160e01b5f52602260045260245ffd5b50919050565b8082018082111561026557634e487b7160e01b5f52601160045260245ffd" as `0x${string}`;

export const mockAgentRegistryAbi = [
  {
    "type": "function",
    "name": "getAgentWallet",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setAgentWallet",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "wallet",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const;

export const mockAgentRegistryBytecode = "0x6080604052348015600e575f80fd5b506101548061001c5f395ff3fe608060405234801561000f575f80fd5b5060043610610033575f3560e01c806233950914610037578063636d2f6414610095575b5f80fd5b61006c6100453660046100f7565b5f9081526020819052604090205473ffffffffffffffffffffffffffffffffffffffff1690565b60405173ffffffffffffffffffffffffffffffffffffffff909116815260200160405180910390f35b6100f56100a336600461010e565b5f9182526020829052604090912080547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff909216919091179055565b005b5f60208284031215610107575f80fd5b5035919050565b5f806040838503121561011f575f80fd5b82359150602083013573ffffffffffffffffffffffffffffffffffffffff81168114610149575f80fd5b80915050925092905056" as `0x${string}`;

export const mockGitHubFactProviderAbi = [
  {
    "type": "function",
    "name": "getFact",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "ready",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "factBlob",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lastRequestId",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mockFulfill",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "factBlob",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "requestFact",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "requestId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "FactFulfilled",
    "inputs": [
      {
        "name": "claimId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "requestId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "factBlob",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      },
      {
        "name": "err",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  }
] as const;

export const mockGitHubFactProviderBytecode = "0x6080604052348015600e575f80fd5b506105d18061001c5f395ff3fe608060405234801561000f575f80fd5b506004361061004a575f3560e01c8063101b3ed31461004e57806337e5952f146100805780638ddec1f514610093578063fbc03a20146100b4575b5f80fd5b61006d61005c3660046102ca565b60016020525f908152604090205481565b6040519081526020015b60405180910390f35b61006d61008e366004610326565b6100c9565b6100a66100a13660046102ca565b61012d565b604051610077929190610391565b6100c76100c23660046103cf565b6101fb565b005b600280545f91826100d983610417565b909155505060025460408051602081018990529081019190915242606082015260800160408051601f1981840301815291815281516020928301205f98895260019092529096208690555093949350505050565b5f818152602081815260408083208151808301909252805460ff161515825260018101805460609486949392908401916101669061043b565b80601f01602080910402602001604051908101604052809291908181526020018280546101929061043b565b80156101dd5780601f106101b4576101008083540402835291602001916101dd565b820191905f5260205f20905b8154815290600101906020018083116101c057829003601f168201915b5050505050815250509050805f015181602001519250925050915091565b604051806040016040528060011515815260200183838080601f0160208091040260200160405190810160405280939291908181526020018383808284375f920182905250939094525050858152602081815260409091208351815460ff191690151517815590830151909150600182019061027790826104d3565b5050505f838152600160205260409081902054905184907fc6ad68e0a531a5774430d3558ac7019fe19d8162a41a5dda0c2930f23e413a26906102bd908690869061058e565b60405180910390a3505050565b5f602082840312156102da575f80fd5b5035919050565b5f8083601f8401126102f1575f80fd5b50813567ffffffffffffffff811115610308575f80fd5b60208301915083602082850101111561031f575f80fd5b9250929050565b5f805f805f6080868803121561033a575f80fd5b85359450602086013567ffffffffffffffff811115610357575f80fd5b610363888289016102e1565b90955093505060408601359150606086013560ff81168114610383575f80fd5b809150509295509295909350565b8215158152604060208201525f82518060408401528060208501606085015e5f606082850101526060601f19601f8301168401019150509392505050565b5f805f604084860312156103e1575f80fd5b83359250602084013567ffffffffffffffff8111156103fe575f80fd5b61040a868287016102e1565b9497909650939450505050565b5f6001820161043457634e487b7160e01b5f52601160045260245ffd5b5060010190565b600181811c9082168061044f57607f821691505b60208210810361046d57634e487b7160e01b5f52602260045260245ffd5b50919050565b634e487b7160e01b5f52604160045260245ffd5b601f8211156104ce57805f5260205f20601f840160051c810160208510156104ac5750805b601f840160051c820191505b818110156104cb575f81556001016104b8565b50505b505050565b815167ffffffffffffffff8111156104ed576104ed610473565b610501816104fb845461043b565b84610487565b6020601f821160018114610533575f831561051c5750848201515b5f19600385901b1c1916600184901b1784556104cb565b5f84815260208120601f198516915b828110156105625787850151825560209485019460019092019101610542565b508482101561057f57868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b60408152816040820152818360608301375f606083830101525f601f19601f840116820160608382030160208401525f606082015260808101915050939250505056" as `0x${string}`;

export const mockFunctionsRouterAbi = [
  {
    "type": "function",
    "name": "fulfill",
    "inputs": [
      {
        "name": "consumer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "requestId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "response",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "err",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "last",
    "inputs": [],
    "outputs": [
      {
        "name": "subscriptionId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "dataVersion",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "callbackGasLimit",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "donId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requestCounter",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "sendRequest",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "dataVersion",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "callbackGasLimit",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "donId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "requestId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Sent",
    "inputs": [
      {
        "name": "requestId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  }
] as const;

export const mockFunctionsRouterBytecode = "0x6080604052348015600e575f80fd5b506106ee8061001c5f395ff3fe608060405234801561000f575f80fd5b506004361061004a575f3560e01c80631b7d0a2d1461004e578063461d27621461006357806347799da814610089578063973a814e146100a2575b5f80fd5b61006161005c366004610375565b6100aa565b005b610076610071366004610418565b610139565b6040519081526020015b60405180910390f35b610091610271565b6040516100809594939291906104b2565b6100765f5481565b6040517f0ca7617500000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff871690630ca7617590610104908890889088908890889060040161053f565b5f604051808303815f87803b15801561011b575f80fd5b505af115801561012d573d5f803e3d5ffd5b50505050505050505050565b5f8054818061014783610577565b91905055505f545f1b90506040518060a001604052808867ffffffffffffffff16815260200187878080601f0160208091040260200160405190810160405280939291908181526020018383808284375f9201919091525050509082525061ffff861660208083019190915263ffffffff86166040830152606090910184905281516001805467ffffffffffffffff191667ffffffffffffffff909216919091178155908201516002906101fb9082610633565b50604082810151600283018054606086015163ffffffff16620100000265ffffffffffff1990911661ffff909316929092179190911790556080909201516003909101555181907f27b5aea9f5736c02241d8a0272e9ec988ea44cf85c4b4760329431aa19678394905f90a29695505050505050565b600180546002805467ffffffffffffffff9092169291610290906105af565b80601f01602080910402602001604051908101604052809291908181526020018280546102bc906105af565b80156103075780601f106102de57610100808354040283529160200191610307565b820191905f5260205f20905b8154815290600101906020018083116102ea57829003601f168201915b505050506002830154600390930154919261ffff8116926201000090910463ffffffff16915085565b5f8083601f840112610340575f80fd5b50813567ffffffffffffffff811115610357575f80fd5b60208301915083602082850101111561036e575f80fd5b9250929050565b5f805f805f806080878903121561038a575f80fd5b863573ffffffffffffffffffffffffffffffffffffffff811681146103ad575f80fd5b955060208701359450604087013567ffffffffffffffff8111156103cf575f80fd5b6103db89828a01610330565b909550935050606087013567ffffffffffffffff8111156103fa575f80fd5b61040689828a01610330565b979a9699509497509295939492505050565b5f805f805f8060a0878903121561042d575f80fd5b863567ffffffffffffffff81168114610444575f80fd5b9550602087013567ffffffffffffffff81111561045f575f80fd5b61046b89828a01610330565b909650945050604087013561ffff81168114610485575f80fd5b9250606087013563ffffffff8116811461049d575f80fd5b95989497509295919493608090920135925050565b67ffffffffffffffff8616815260a060208201525f85518060a0840152806020880160c085015e5f60c0828501015260c0601f19601f83011684010191505061ffff8516604083015263ffffffff841660608301528260808301529695505050505050565b81835281816020850137505f828201602090810191909152601f909101601f19169091010190565b858152606060208201525f610558606083018688610517565b828103604084015261056b818587610517565b98975050505050505050565b5f6001820161059457634e487b7160e01b5f52601160045260245ffd5b5060010190565b634e487b7160e01b5f52604160045260245ffd5b600181811c908216806105c357607f821691505b6020821081036105e157634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561062e57805f5260205f20601f840160051c8101602085101561060c5750805b601f840160051c820191505b8181101561062b575f8155600101610618565b50505b505050565b815167ffffffffffffffff81111561064d5761064d61059b565b6106618161065b84546105af565b846105e7565b6020601f821160018114610693575f831561067c5750848201515b5f19600385901b1c1916600184901b17845561062b565b5f84815260208120601f198516915b828110156106c257878501518255602094850194600190920191016106a2565b50848210156106df57868401515f19600387901b60f8161c191681555b50505050600190811b0190555056" as `0x${string}`;
