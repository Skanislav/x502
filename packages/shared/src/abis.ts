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
      },
      {
        "name": "_eas",
        "type": "address",
        "internalType": "contract IEAS"
      },
      {
        "name": "_schemaUID",
        "type": "bytes32",
        "internalType": "bytes32"
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
    "name": "eas",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IEAS"
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
        "name": "attestationUIDs",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
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
    "name": "schemaUID",
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
        "name": "attesters",
        "type": "address[]",
        "indexed": false,
        "internalType": "address[]"
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
    "name": "AttestationClaimMismatch",
    "inputs": [
      {
        "name": "uid",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "AttestationDeclined",
    "inputs": [
      {
        "name": "uid",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "AttestationExpired",
    "inputs": [
      {
        "name": "uid",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "AttestationFactMismatch",
    "inputs": [
      {
        "name": "uid",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "AttestationRevoked",
    "inputs": [
      {
        "name": "uid",
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
    "name": "DuplicateAttester",
    "inputs": [
      {
        "name": "attester",
        "type": "address",
        "internalType": "address"
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
    "name": "FactMergeMissing",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FactNotReady",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FactStatusNotOk",
    "inputs": [
      {
        "name": "status",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientAttestations",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientRepoBalance",
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
    "name": "RecipientNotBound",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "bound",
        "type": "address",
        "internalType": "address"
      }
    ]
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
    "name": "ThresholdZero",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnknownAttestation",
    "inputs": [
      {
        "name": "uid",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "UntrustedAttester",
    "inputs": [
      {
        "name": "attester",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "WrongSchema",
    "inputs": [
      {
        "name": "schema",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  }
] as const;

export const bountyVaultBytecode = "0x6101203461011a57601f61178938819003918201601f19168301916001600160401b0383118484101761011e5780849260a09460405283398101031261011a578051906001600160a01b038216820361011a5760208101516001600160a01b038116810361011a576040820151906001600160a01b038216820361011a576060830151926001600160a01b038416840361011a57608001519360015f5560805260a05260c05260e052610100526040516116569081610133823960805181818161055d01528181610928015281816112100152611328015260a0518181816107cf01526112b1015260c051818181610471015261068f015260e0518181816103c40152610aed0152610100518181816101130152610b2c0152f35b5f80fd5b634e487b7160e01b5f52604160045260245ffdfe60806040526004361015610011575f80fd5b5f3560e01c8063040cf020146112d55780630d1cfcae146112925780631795ba80146112625780631de26e161461118857806339b810ab146105815780633e413bee1461053e578063447ec2751461049557806363c326f0146104525780636c7f1542146104255780637f627f81146103e85780638150864d146103a55780638928735b14610378578063af89e39f14610345578063db7dc80914610136578063f3de0506146100fc5763feef6640146100c9575f80fd5b346100f85760203660031901126100f8576004355f526002602052602060ff60405f2054166040519015158152f35b5f80fd5b346100f8575f3660031901126100f85760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b346100f8576101003660031901126100f85760043560243567ffffffffffffffff81116100f85761016b903690600401611394565b91906044359260ff84168094036100f85760803660631901126100f857825f52600160205260405f209160098301805460ff81165f1461030f5750506001600160a01b0383541633036102e7575b84156102bf57600283019067ffffffffffffffff83116102ab576801000000000000000083116102ab578154838355808410610285575b50905f5260205f205f5b8381106102715786867f6f9d652e4404079a96c378a56c6daca76446bd8122dfe4c5a3722d3d00d191a260206001600160a01b0389600381018660ff198254161790556064356004820155608435600582015560a435600682015560c435600782015560e4356008820155541693604051908152a3005b6001906020843594019381840155016101fa565b825f528360205f2091820191015b8181106102a057506101f0565b5f8155600101610293565b634e487b7160e01b5f52604160045260245ffd5b7f9dd75d79000000000000000000000000000000000000000000000000000000005f5260045ffd5b7f7735d60b000000000000000000000000000000000000000000000000000000005f5260045ffd5b84547fffffffffffffffffffffffff0000000000000000000000000000000000000000163317855560ff191660011790556101b9565b346100f85760203660031901126100f8576004355f52600160205260206001600160a01b0360405f205416604051908152f35b346100f85760203660031901126100f8576004355f5260016020526020600860405f200154604051908152f35b346100f8575f3660031901126100f85760206040516001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000168152f35b346100f85760403660031901126100f85760243560048110156100f85761041d6020916004355f526001835260405f206115ac565b604051908152f35b346100f85760203660031901126100f8576004355f5260016020526020600160405f200154604051908152f35b346100f8575f3660031901126100f85760206040516001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000168152f35b346100f85760203660031901126100f8576004355f526001602052600260405f2001604051806020835491828152019081935f5260205f20905f5b81811061052857505050816104e69103826113ee565b604051918291602083019060208452518091526040830191905f5b81811061050f575050500390f35b8251845285945060209384019390920191600101610501565b82548452602090930192600192830192016104d0565b346100f8575f3660031901126100f85760206040516001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000168152f35b346100f85760e03660031901126100f857600460443510156100f8576001600160a01b0360643516606435036100f85760c43567ffffffffffffffff81116100f8576105d1903690600401611394565b6105d961149b565b6084354211611160576004355f52600160205260405f209160ff600984015416156111385760ff60038401541682106111105760405160208101906004358252602435604082015260ff6044351660608201526060815261063b6080826113ee565b51902092835f52600260205260ff60405f2054166110e457604051907f8ddec1f50000000000000000000000000000000000000000000000000000000082528460048301525f826024816001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000165afa91821561089e575f905f93611096575b501561106e578151602083019060a43590822003611046575f60606040516106e8816113d2565b82815282602082015282604082015201526080838051810103126100f857519160ff83168093036100f85761071f60408201611529565b9260806060830151920151916001600160a01b0383168093036100f85760405160609161074b826113d2565b83825267ffffffffffffffff60208301971687526040820152019182526001810361101b57505f9260026044351490811561100b575b81610ff7575b50610fcf576001600160a01b0360643516158015610fb0575b610f6b57506107b0849594611556565b9060028101928354956107c287611556565b955f986001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016995b898110156108a9578a90885f52602081815f2001546024604051809581937e33950900000000000000000000000000000000000000000000000000000000835260048301525afa801561089e575f90610865575b600192506001600160a01b0361085b838d611473565b91169052016107f1565b506020823d8211610896575b8161087e602093836113ee565b810103126100f857610891600192611598565b610845565b3d9150610871565b6040513d5f823e3d90fd5b50875f915b808310610a9d57505050506108c5604435846115ac565b9060088401918254865190818102918183041490151715610a895781811015610a61576108f4600191836113c5565b95019080825410610a395761092490835f97969752600260205260405f20600160ff1982541617905582546113c5565b90557f0000000000000000000000000000000000000000000000000000000000000000925f5b865181101561097c57806109766001600160a01b0361096b6001948b611473565b5116865490886114d2565b0161094a565b8683838861098d826064358b6114d2565b604051916080830191610a255760443583526001600160a01b036064351660208401526040830152608060608301528351809152602060a083019401905f5b818110610a0657505050807f6c374b80283f7e18eb966fee0513ecbc34ac33058e865285faed55d2e061471291600435940390a360015f55005b82516001600160a01b03168652602095860195909201916001016109cc565b634e487b7160e01b5f52602160045260245ffd5b7f822eeced000000000000000000000000000000000000000000000000000000005f5260045ffd5b7f7dacea96000000000000000000000000000000000000000000000000000000005f5260045ffd5b634e487b7160e01b5f52601160045260245ffd5b9194610ab08684869994969a979a611588565b3597604051987fa3112a64000000000000000000000000000000000000000000000000000000008a5260048a01525f896024816001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000165afa98891561089e575f99610e63575b50885115610e2c5760208901517f00000000000000000000000000000000000000000000000000000000000000008103610e01575067ffffffffffffffff60808a015116610dca5767ffffffffffffffff60608a0151168015159081610dc0575b50610d89576101208901516060818051810103126100f85760208101519082610bae606060408401519301611410565b9203610d525760a43503610d1b5715610ce4575f5b878110610c8757505f975f5b8651811015610c77576001600160a01b03610bea8289611473565b51166001600160a01b0360e08d01511614610c0757600101610bcf565b5093929750949760019691965b15610c3e57906001600160a01b0360e0600193015116610c34828b611473565b52019192906108ae565b60e06001600160a01b03910151167fda1131a7000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b5093929798909598969196610c14565b6001600160a01b03610c998289611473565b51166001600160a01b0360e08c015116809114610cb95750600101610bc3565b7feea4cdf1000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b610cef87858a611588565b357f18e126db000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b610d2688868b611588565b357fdebf232c000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b610d5d89878c611588565b357f33ae1e73000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b610d9487858a611588565b357f4f51d3f5000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b905042118a610b7e565b610dd587858a611588565b357f04bed256000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b7f71fe074b000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b610e3787858a611588565b357f7529e23c000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b9098503d805f833e610e7581836113ee565b8101906020818303126100f85780519067ffffffffffffffff82116100f85701610140818303126100f85760405191610140830183811067ffffffffffffffff8211176102ab576040528151835260208201516020840152610ed960408301611529565b6040840152610eea60608301611529565b6060840152610efb60808301611529565b608084015260a082015160a0840152610f1660c08301611598565b60c0840152610f2760e08301611598565b60e0840152610f396101008301611410565b61010084015261012082015167ffffffffffffffff81116100f857610f5e920161141d565b6101208201529789610b1d565b6001600160a01b039051167f5d82df7b000000000000000000000000000000000000000000000000000000005f526001600160a01b036064351660045260245260445ffd5b506001600160a01b038151166001600160a01b036064351614156107a0565b7f0ad58e23000000000000000000000000000000000000000000000000000000005f5260045ffd5b67ffffffffffffffff915051161587610787565b5f94506044356003149150610781565b7f0c9ec4ae000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b7fe5fedfae000000000000000000000000000000000000000000000000000000005f5260045ffd5b7fa1d03ed1000000000000000000000000000000000000000000000000000000005f5260045ffd5b9250503d805f843e6110a881846113ee565b8201916040818403126100f8576110be81611410565b92602082015167ffffffffffffffff81116100f8576110dd920161141d565b91866106c1565b837ff4b76a0e000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b7fe424f994000000000000000000000000000000000000000000000000000000005f5260045ffd5b7f2c32c26f000000000000000000000000000000000000000000000000000000005f5260045ffd5b7f1ab7da6b000000000000000000000000000000000000000000000000000000005f5260045ffd5b346100f8576111963661137e565b90805f52600160205260405f2060ff6009820154161561113857600101805490838201809211610a8957556112346040517f23b872dd0000000000000000000000000000000000000000000000000000000060208201523360248201523060448201528360648201526064815261120e6084826113ee565b7f00000000000000000000000000000000000000000000000000000000000000006115e9565b6040519182527f87d4c0b5e30d6808bc8a94ba1c4d839b29d664151551a31753387ee9ef48429b60203393a3005b346100f85760203660031901126100f8576004355f526001602052602060ff600360405f20015416604051908152f35b346100f8575f3660031901126100f85760206040516001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000168152f35b346100f8576112e33661137e565b906112ec61149b565b805f52600160205260405f206001600160a01b0381541633036102e7576001018054838110610a39578361131f916113c5565b905561134c82337f00000000000000000000000000000000000000000000000000000000000000006114d2565b6040519182527f04eda370f8b8612fa7266d7ebbd41af9d694e19793fe9d9ff31b3ddbd99b08e160203393a360015f55005b60409060031901126100f8576004359060243590565b9181601f840112156100f85782359167ffffffffffffffff83116100f8576020808501948460051b0101116100f857565b91908203918211610a8957565b6080810190811067ffffffffffffffff8211176102ab57604052565b90601f8019910116810190811067ffffffffffffffff8211176102ab57604052565b519081151582036100f857565b81601f820112156100f85780519067ffffffffffffffff82116102ab5760405192611452601f8401601f1916602001856113ee565b828452602083830101116100f857815f9260208093018386015e8301015290565b80518210156114875760209160051b010190565b634e487b7160e01b5f52603260045260245ffd5b60025f54146114aa5760025f55565b7f3ee5aeb5000000000000000000000000000000000000000000000000000000005f5260045ffd5b611527926001600160a01b03604051937fa9059cbb0000000000000000000000000000000000000000000000000000000060208601521660248401526044830152604482526115226064836113ee565b6115e9565b565b519067ffffffffffffffff821682036100f857565b67ffffffffffffffff81116102ab5760051b60200190565b906115608261153e565b61156d60405191826113ee565b828152809261157e601f199161153e565b0190602036910137565b91908110156114875760051b0190565b51906001600160a01b03821682036100f857565b906004811015610a255780156115e157600181146115d9576002146115d2576007015490565b6006015490565b506005015490565b506004015490565b905f602091828151910182855af11561089e575f513d61164d57506001600160a01b0381163b155b6116185750565b6001600160a01b03907f5274afe7000000000000000000000000000000000000000000000000000000005f521660045260245ffd5b6001141561161156" as `0x${string}`;

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

export const gitHubFactReceiverBytecode = "0x60a0346100ed57601f611fa838819003918201601f19168301916001600160401b038311848410176100f15780849260409485528339810103126100ed57610052602061004b83610105565b9201610105565b6001600160a01b039182166080525f8054919092166001600160a01b0319918216811783556001805490921681179091556040519181907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08180a37fb251079a3e59729d2256949e48e44b7959908cdf34789078b6a1462ec32767205f80a2611e8e908161011a82396080518181816102e6015261161d0152f35b5f80fd5b634e487b7160e01b5f52604160045260245ffd5b51906001600160a01b03821682036100ed5756fe60806040526004361015610011575f80fd5b5f3560e01c8063058a628f146100e45780630ca76175146100df57806316bfdcdc146100da57806321bf35f5146100d557806337e5952f146100d057806367e828bf146100cb57806379502c55146100c65780638da5cb5b146100c15780638ddec1f5146100bc57806399bb4094146100b757806399d25455146100b2578063d09edf31146100ad5763f2fde38b146100a8575f80fd5b610b69565b610b43565b6109c4565b61099a565b6108a4565b610866565b610811565b6107e2565b61061d565b61047f565b610417565b610287565b61010f565b602090600319011261010b576004356001600160a01b038116810361010b5790565b5f80fd5b3461010b5761011d366100e9565b6001600160a01b035f5416330361017c576001600160a01b03168073ffffffffffffffffffffffffffffffffffffffff1960015416176001557fb251079a3e59729d2256949e48e44b7959908cdf34789078b6a1462ec32767205f80a2005b7f30cd7471000000000000000000000000000000000000000000000000000000005f5260045ffd5b634e487b7160e01b5f52604160045260245ffd5b6040810190811067ffffffffffffffff8211176101d457604052565b6101a4565b60a0810190811067ffffffffffffffff8211176101d457604052565b90601f8019910116810190811067ffffffffffffffff8211176101d457604052565b67ffffffffffffffff81116101d457601f01601f191660200190565b92919261023f82610217565b9161024d60405193846101f5565b82948184528183011161010b578281602093845f960137010152565b9080601f8301121561010b5781602061028493359101610233565b90565b3461010b57606036600319011261010b5760043560243567ffffffffffffffff811161010b576102bb903690600401610269565b60443567ffffffffffffffff811161010b576102db903690600401610269565b906001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001633036103ef57825f52600860205260405f20549081156103c75783927fc6ad68e0a531a5774430d3558ac7019fe19d8162a41a5dda0c2930f23e413a2691845f5260086020525f6040812055815115610392575b61036960405192839283610f3e565b0390a37f85e1543bf2f84fe80c6badbce3648c8539ad1df4d2b3d822938ca0538be727e65f80a2005b6103c26040516103a1816101b8565b600181528260208201526103bd865f52600660205260405f2090565b610e59565b61035a565b7f6d080297000000000000000000000000000000000000000000000000000000005f5260045ffd5b7fc6829f83000000000000000000000000000000000000000000000000000000005f5260045ffd5b3461010b57602036600319011261010b576004355f526008602052602060405f2054604051908152f35b6004359067ffffffffffffffff8216820361010b57565b6084359067ffffffffffffffff8216820361010b57565b6064359060ff8216820361010b57565b3461010b5760a036600319011261010b57610498610441565b6024359063ffffffff82169081830361010b57604435916104b761046f565b936104c0610458565b916001600160a01b035f5416330361017c5761059660806105896105796105ea966105bb958967ffffffffffffffff60ff7fada7c059d03027c2d19603401220dcab0db47516c3cb26f0ee1218a123b1548f9e8e8360405195610522876101d9565b1695868652602086015260408501521693846060840152169586910152600354906bffffffff00000000000000008960401b16916bffffffffffffffffffffffff191617176003556105738a600455565b60ff1690565b60ff1660ff196005541617600555565b67ffffffffffffffff1690565b68ffffffffffffffff006005549160081b169068ffffffffffffffff00191617600555565b6040519384938491604091949363ffffffff9167ffffffffffffffff6060860197168552602085015216910152565b0390a1005b9181601f8401121561010b5782359167ffffffffffffffff831161010b576020838186019501011161010b57565b3461010b57608036600319011261010b5760043560243567ffffffffffffffff811161010b576106519036906004016105ef565b9161065a61046f565b9061067c6106706001546001600160a01b031690565b6001600160a01b031690565b33036106a7576106a3936106939360443592610cb3565b6040519081529081906020820190565b0390f35b7f9e5c42e8000000000000000000000000000000000000000000000000000000005f5260045ffd5b90600182811c921680156106fd575b60208310146106e957565b634e487b7160e01b5f52602260045260245ffd5b91607f16916106de565b604051905f826002549161071a836106cf565b808352926001811690811561079f5750600114610740575b61073e925003836101f5565b565b5060025f90815290917f405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace5b81831061078357505090602061073e92820101610732565b602091935080600191548385890101520191019091849261076b565b6020925061073e94915060ff191682840152151560051b820101610732565b805180835260209291819084018484015e5f828201840152601f01601f1916010190565b3461010b575f36600319011261010b576106a36107fd610707565b6040519182916020835260208301906107be565b3461010b575f36600319011261010b5760a060035467ffffffffffffffff6004546005549063ffffffff60405194848116865260401c166020850152604084015260ff8116606084015260081c166080820152f35b3461010b575f36600319011261010b5760206001600160a01b035f5416604051908152f35b60409061028493921515815281602082015201906107be565b3461010b57602036600319011261010b576004355f52600660205260405f206001604051916108d2836101b8565b60ff81541615158352019060405180925f908054906108f0826106cf565b80855291600181169081156109735750600114610934575b8361092586610919838703846101f5565b82602082015251151590565b6106a36040519283928361088b565b5f908152602081209092505b818310610957575050810160200181610919610908565b6020919350806001915483858901015201910190918492610940565b60ff191660208681019190915292151560051b850190920192508391506109199050610908565b3461010b57602036600319011261010b576004355f526007602052602060405f2054604051908152f35b3461010b57602036600319011261010b5760043567ffffffffffffffff811161010b576109f59036906004016105ef565b6001600160a01b035f5416330361017c5767ffffffffffffffff81116101d457610a2981610a246002546106cf565b610dde565b5f91601f8211600114610a9b5790610a7d81807f0e7cd0cf40501b9611b706a4ef8b94345fdce2b642230cf2496856c3f4f4b619956105ea955f92610a90575b50508160011b915f199060031b1c19161790565b6002556040519081529081906020820190565b013590505f80610a69565b60025f52601f198216927f405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace935f5b818110610b2b5750917f0e7cd0cf40501b9611b706a4ef8b94345fdce2b642230cf2496856c3f4f4b6199491846105ea959410610b12575b505050600181811b01600255610693565b01355f19600384901b60f8161c191690555f8080610b01565b91946020600181928887013581550196019201610ac9565b3461010b575f36600319011261010b5760206001600160a01b0360015416604051908152f35b3461010b57610b77366100e9565b5f54906001600160a01b0382169182330361017c576001600160a01b0373ffffffffffffffffffffffffffffffffffffffff19921680937f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e05f80a316175f55005b6040519060e0820182811067ffffffffffffffff8211176101d457604052606060c0835f81525f60208201525f604082015282808201528260808201528260a08201520152565b60405160809190610c3083826101f5565b6003815291601f1901825f5b828110610c4857505050565b806060602080938501015201610c3c565b634e487b7160e01b5f52603260045260245ffd5b805115610c7a5760200190565b610c59565b805160011015610c7a5760400190565b805160021015610c7a5760600190565b8051821015610c7a5760209160051b010190565b9493610d6292610d4360ff610d5d93610d29610d8a98610d10610cd4610bd8565b98610ce6610ce0610707565b8b6116aa565b60055467ffffffffffffffff600882901c1680610db4575b5050610d08610c1f565b973691610233565b610d1987610c6d565b52610d2386610c6d565b506110e8565b610d3285610c7f565b52610d3c84610c7f565b50166110e8565b610d4c82610c8f565b52610d5681610c8f565b50826111cc565b6113a8565b600354610d8067ffffffffffffffff82169160401c63ffffffff1690565b90600454926115a4565b9182610d9e825f52600760205260405f2090565b55610db1835f52600860205260405f2090565b55565b610dc19160ff168c610f86565b5f80610cfe565b818110610dd3575050565b5f8155600101610dc8565b90601f8211610deb575050565b61073e9160025f5260205f20906020601f840160051c83019310610e17575b601f0160051c0190610dc8565b9091508190610e0a565b9190601f8111610e3057505050565b61073e925f5260205f20906020601f840160051c83019310610e1757601f0160051c0190610dc8565b60016020919392938451151560ff801983541691161781550192015191825167ffffffffffffffff81116101d457610e9b81610e9584546106cf565b84610e21565b6020601f8211600114610ed9578190610eca9394955f92610ece5750508160011b915f199060031b1c19161790565b9055565b015190505f80610a69565b601f19821690610eec845f5260205f2090565b915f5b818110610f2657509583600195969710610f0e575b505050811b019055565b01515f1960f88460031b161c191690555f8080610f04565b9192602060018192868b015181550194019201610eef565b9091610f55610284936040845260408401906107be565b9160208184039101526107be565b634e487b7160e01b5f52602160045260245ffd5b60031115610f8157565b610f63565b919061102a608092611024610f99611701565b93610fe860ff604092610fe18451610fb186826101f5565b600681527f736c6f7449440000000000000000000000000000000000000000000000000000602082015289611731565b1686611975565b610ff4815191826101f5565b600781527f76657273696f6e00000000000000000000000000000000000000000000000000602082015284611731565b82611975565b600260208401525151910152565b634e487b7160e01b5f52601160045260245ffd5b5f19811461105a5760010190565b611038565b9061106982610217565b61107660405191826101f5565b8281528092611087601f1991610217565b0190602036910137565b5f1981019190821161105a57565b601f1981019190821161105a57565b603001908160301161105a57565b906020820180921161105a57565b9190820180921161105a57565b908151811015610c7a570160200190565b90811561118f575f82805b611170575080611103849261105f565b915b61110e57509150565b61111a61116991611091565b9361115561112d610573600a84066110ae565b60f81b7fff000000000000000000000000000000000000000000000000000000000000001690565b5f1a61116186856110d7565b53600a900490565b9283611105565b929061117e6111869161104c565b93600a900490565b809391936110f3565b905060405161119f6040826101f5565b600181527f3000000000000000000000000000000000000000000000000000000000000000602082015290565b8151156111d95760a00152565b7ffe936cb7000000000000000000000000000000000000000000000000000000005f5260045ffd5b604051906112106040836101f5565b600c82527f636f64654c6f636174696f6e00000000000000000000000000000000000000006020830152565b6040519061124b6040836101f5565b600882527f6c616e67756167650000000000000000000000000000000000000000000000006020830152565b60011115610f8157565b604051906112906040836101f5565b600682527f736f7572636500000000000000000000000000000000000000000000000000006020830152565b604051906112cb6040836101f5565b600482527f61726773000000000000000000000000000000000000000000000000000000006020830152565b604051906113066040836101f5565b600f82527f736563726574734c6f636174696f6e00000000000000000000000000000000006020830152565b604051906113416040836101f5565b600782527f73656372657473000000000000000000000000000000000000000000000000006020830152565b6040519061137c6040836101f5565b600982527f62797465734172677300000000000000000000000000000000000000000000006020830152565b6113b0611701565b906113c26113bc611201565b83611731565b6113df81516113d081610f77565b6113d981610f77565b83611819565b6113ea6113bc61123c565b61140460408201516113fb81611277565b6113d981611277565b61140f6113bc611281565b61141d606082015183611731565b60a08101805151611532575b50608081019081515161149c575b60c091500180515161144a575b50515190565b916114566113bc61136d565b61145f82611846565b5f5b83518051821015611489579061148361147c82600194610c9f565b518561188a565b01611461565b5050915061149681611868565b5f611444565b6020810180516114ab81610f77565b6114b481610f77565b1561150a5760c0926114ed611505926114d46114ce6112f7565b88611731565b516114de81610f77565b6114e781610f77565b86611819565b6114fe6114f8611332565b86611731565b518461188a565b611437565b7fa80d31f7000000000000000000000000000000000000000000000000000000005f5260045ffd5b9261154461153e6112bc565b84611731565b61154d83611846565b5f5b84518051821015611577579061157161156a82600194610c9f565b5186611731565b0161154f565b5050925061158482611868565b5f611429565b9081602091031261010b575190565b6040513d5f823e3d90fd5b929060209267ffffffffffffffff9263ffffffff6115fd60405197889687967f461d276200000000000000000000000000000000000000000000000000000000885216600487015260a0602487015260a48601906107be565b9260016044860152166064840152608483015203815f6001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000165af19081156116a5575f91611676575b50807f1131472297a800fee664d1d89cfa8f7676ff07189ecc53f80bbb5f4969099db85f80a290565b611698915060203d60201161169e575b61169081836101f5565b81019061158a565b5f61164d565b503d611686565b611599565b8151156116c0575f808252604082015260600152565b7f22ce3edd000000000000000000000000000000000000000000000000000000005f5260045ffd5b604051906116f5826101b8565b5f602083606081520152565b60405161170d816101b8565b5f6117166116e8565b80835261172c6101006020850192848452611924565b505290565b815161178192919067ffffffffffffffff166017811161178457815161176c916117669061175f6060610573565b1760ff1690565b90611b68565b505b51906117786116e8565b50805191611dd2565b50565b60ff81116117b15781516117ab91906117a390601860605b1790611b68565b508251611d52565b5061176e565b61ffff81116117d65781516117ab91906117ce906019606061179c565b508251611cd9565b63ffffffff81116117fd5781516117ab91906117f590601a606061179c565b508251611c60565b81516117ab919061181190601b606061179c565b508251611be2565b9061073e916118288151611af8565b50604051916020830152602082526118416040836101f5565b61188a565b602090611855609f8251611b68565b50018051906001820180921161105a5752565b60209061187760ff8251611b68565b500180515f1981019190821161105a5752565b815161178192919067ffffffffffffffff16601781116118b857815161176c916117669061175f6040610573565b60ff81116118d45781516117ab91906117a3906018604061179c565b61ffff81116118f15781516117ab91906117ce906019604061179c565b63ffffffff81116119105781516117ab91906117f590601a604061179c565b81516117ab919061181190601b604061179c565b9061192d6116e8565b50601f81168061195b575b50806020830152604051908183525f8252810160200190811061010b5760405290565b6020036020811161105a57810180911161105a575f611938565b9067ffffffffffffffff81166017811161199d57509051611781916117669061175f5f610573565b905060ff81116119c157815161178192906119ba9060185f61179c565b5051611d52565b61ffff81116119e457815161178192906119dd9060195f61179c565b5051611cd9565b63ffffffff8111611a095781516117819290611a0290601a5f61179c565b5051611c60565b81516117819290611a1c90601b5f61179c565b5051611be2565b90611a2c6116e8565b508051611a376116e8565b50611a458251821115611dcb565b82515191611a5382846110ca565b9060208501518211611acb575b602091855183815196820101958211611ac3575b505001905b6020811015611a9d575f19906020036101000a019081199051169082511617905290565b9091611ab8611ab2611abe92855181526110bc565b936110bc565b9161109f565b611a79565b525f80611a74565b611add611ad783611ae2565b86611e77565b611a60565b908160011b918083046002149015171561105a57565b611b006116e8565b50805151600181019081811161105a576020830151811015611b39575b60c260208451928301015380518211611b3557505090565b5290565b8160011b8281046002148315171561105a57611b6290611b5b85519186611924565b5084611a23565b50611b1d565b90611b716116e8565b50815151600181019182821161105a576020840151821015611ba4575b60208451928301015380518211611b3557505090565b8260011b8381046002148415171561105a57611bcd90611bc686519187611924565b5085611a23565b50611b8e565b601f811161105a576101000a90565b90611beb6116e8565b5081515180600801918260081161105a5760208401518311611c38575b611c1a611c156008611bd3565b611091565b906008855193840101911982511617905280518211611b3557505090565b8260011b8381046002148415171561105a57611c5a90611bc686519187611924565b50611c08565b90611c696116e8565b5081515180600401918260041161105a5760208401518311611cb1575b611c93611c156004611bd3565b906004855193840101911982511617905280518211611b3557505090565b8260011b8381046002148415171561105a57611cd390611bc686519187611924565b50611c86565b90611ce26116e8565b5081515180600201918260021161105a5760208401518311611d2a575b611d0c611c156002611bd3565b906002855193840101911982511617905280518211611b3557505090565b8260011b8381046002148415171561105a57611d4c90611bc686519187611924565b50611cff565b90611d5b6116e8565b5081515180600101918260011161105a5760208401518311611da3575b611d85611c156001611bd3565b906001855193840101911982511617905280518211611b3557505090565b8260011b8381046002148415171561105a57611dc590611bc686519187611924565b50611d78565b1561010b57565b91611ddb6116e8565b50611de98251821115611dcb565b602083515192611df983856110ca565b828601518111611e60575b855183815196820101958211611e58575b505001905b6020811015611e3e575f19906020036101000a019081199051169082511617905290565b9091611ab8611ab2611e5392855181526110bc565b611e1a565b525f80611e15565b611e72611e6c82611ae2565b87611e77565b611e04565b9061178191611e8881519282611924565b50611a2356" as `0x${string}`;

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

export const mockUSDCBytecode = "0x60806040523461031957604080519081016001600160401b0381118282101761022c576040908152600f82526e55534420436f696e20286d6f636b2960881b602083015280519081016001600160401b0381118282101761022c5760405260048152635553444360e01b602082015281516001600160401b03811161022c57600354600181811c9116801561030f575b602082101461020e57601f81116102ac575b50602092601f821160011461024b57928192935f92610240575b50508160011b915f199060031b1c1916176003555b80516001600160401b03811161022c57600454600181811c91168015610222575b602082101461020e57601f81116101ab575b50602091601f821160011461014b579181925f92610140575b50508160011b915f199060031b1c1916176004555b60405161070b908161031e8239f35b015190505f8061011c565b601f1982169260045f52805f20915f5b8581106101935750836001951061017b575b505050811b01600455610131565b01515f1960f88460031b161c191690555f808061016d565b9192602060018192868501518155019401920161015b565b60045f527f8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b601f830160051c81019160208410610204575b601f0160051c01905b8181106101f95750610103565b5f81556001016101ec565b90915081906101e3565b634e487b7160e01b5f52602260045260245ffd5b90607f16906100f1565b634e487b7160e01b5f52604160045260245ffd5b015190505f806100bb565b601f1982169360035f52805f20915f5b868110610294575083600195961061027c575b505050811b016003556100d0565b01515f1960f88460031b161c191690555f808061026e565b9192602060018192868501518155019401920161025b565b60035f527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b601f830160051c81019160208410610305575b601f0160051c01905b8181106102fa57506100a1565b5f81556001016102ed565b90915081906102e4565b90607f169061008f565b5f80fdfe6080806040526004361015610012575f80fd5b5f3560e01c90816306fdde031461050a57508063095ea7b31461048857806318160ddd1461046b57806323b872dd1461033b578063313ce5671461032057806340c10f191461026557806370a082311461022e57806395d89b4114610113578063a9059cbb146100e25763dd62ed3e1461008a575f80fd5b346100de5760403660031901126100de576100a3610603565b6001600160a01b036100b3610619565b91165f5260016020526001600160a01b0360405f2091165f52602052602060405f2054604051908152f35b5f80fd5b346100de5760403660031901126100de576101086100fe610603565b602435903361062f565b602060405160018152f35b346100de575f3660031901126100de576040515f6004548060011c90600181168015610224575b602083108114610210578285529081156101f4575060011461019f575b50819003601f01601f191681019067ffffffffffffffff82118183101761018b57610187829182604052826105d9565b0390f35b634e487b7160e01b5f52604160045260245ffd5b905060045f527f8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b5f905b8282106101de57506020915082010182610157565b60018160209254838588010152019101906101c9565b90506020925060ff191682840152151560051b82010182610157565b634e487b7160e01b5f52602260045260245ffd5b91607f169161013a565b346100de5760203660031901126100de576001600160a01b0361024f610603565b165f525f602052602060405f2054604051908152f35b346100de5760403660031901126100de5761027e610603565b6001600160a01b031660243581156102f457600254908082018092116102e05760207fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef915f9360025584845283825260408420818154019055604051908152a3005b634e487b7160e01b5f52601160045260245ffd5b7fec442f05000000000000000000000000000000000000000000000000000000005f525f60045260245ffd5b346100de575f3660031901126100de57602060405160068152f35b346100de5760603660031901126100de57610354610603565b61035c610619565b604435906001600160a01b03831692835f52600160205260405f206001600160a01b0333165f5260205260405f20545f19811061039f575b50610108935061062f565b83811061043757841561040b5733156103df57610108945f52600160205260405f206001600160a01b0333165f526020528360405f209103905584610394565b7f94280d62000000000000000000000000000000000000000000000000000000005f525f60045260245ffd5b7fe602df05000000000000000000000000000000000000000000000000000000005f525f60045260245ffd5b83907ffb8f41b2000000000000000000000000000000000000000000000000000000005f523360045260245260445260645ffd5b346100de575f3660031901126100de576020600254604051908152f35b346100de5760403660031901126100de576104a1610603565b60243590331561040b576001600160a01b03169081156103df57335f52600160205260405f20825f526020528060405f20556040519081527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560203392a3602060405160018152f35b346100de575f3660031901126100de575f6003548060011c906001811680156105cf575b602083108114610210578285529081156101f4575060011461057a5750819003601f01601f191681019067ffffffffffffffff82118183101761018b57610187829182604052826105d9565b905060035f527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b5f905b8282106105b957506020915082010182610157565b60018160209254838588010152019101906105a4565b91607f169161052e565b602060409281835280519182918282860152018484015e5f828201840152601f01601f1916010190565b600435906001600160a01b03821682036100de57565b602435906001600160a01b03821682036100de57565b6001600160a01b03169081156106df576001600160a01b03169182156102f457815f525f60205260405f20548181106106ad57817fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92602092855f525f84520360405f2055845f525f825260405f20818154019055604051908152a3565b827fe450d38c000000000000000000000000000000000000000000000000000000005f5260045260245260445260645ffd5b7f96c6fd1e000000000000000000000000000000000000000000000000000000005f525f60045260245ffd" as `0x${string}`;

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

export const mockAgentRegistryBytecode = "0x6080806040523460135760d3908160188239f35b5f80fdfe60808060405260043610156011575f80fd5b5f3560e01c90816233950914609a575063636d2f6414602e575f80fd5b34609657604036600319011260965760243573ffffffffffffffffffffffffffffffffffffffff81168091036096576004355f525f60205260405f20907fffffffffffffffffffffffff00000000000000000000000000000000000000008254161790555f80f35b5f80fd5b3460965760203660031901126096576020906004355f525f825273ffffffffffffffffffffffffffffffffffffffff60405f2054168152f3" as `0x${string}`;

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

export const mockGitHubFactProviderBytecode = "0x6080806040523460155761051d908161001a8239f35b5f80fdfe6080806040526004361015610012575f80fd5b5f3560e01c908163101b3ed3146104535750806337e5952f146103ab5780638ddec1f5146102a15763fbc03a2014610048575f80fd5b3461029d57604036600319011261029d5760043560243567ffffffffffffffff811161029d5761007c903690600401610479565b919060405161008a816104a7565b6001815267ffffffffffffffff841161028957604051601f8501601f1916916100b660208401836104c3565b858252368685011161029d57600190868560208501375f6020888501015260208101928352855f525f60205260405f209051151560ff8019835416911617815501905180519067ffffffffffffffff82116102895761011583546104e5565b601f8111610244575b50602090601f83116001146101bb579180602094927fc6ad68e0a531a5774430d3558ac7019fe19d8162a41a5dda0c2930f23e413a269796945f926101b0575b50508160011b915f199060031b1c19161790555b845f52600182525f6060604082205497806040519660408852816040890152838801378501015282015f6060808584030192838587015201520190a3005b015190505f8061015e565b90601f19831691845f52815f20925f5b81811061022c57509260019285927fc6ad68e0a531a5774430d3558ac7019fe19d8162a41a5dda0c2930f23e413a269998966020989610610214575b505050811b019055610172565b01515f1960f88460031b161c191690555f8080610207565b929360206001819287860151815501950193016101cb565b835f5260205f20601f840160051c8101916020851061027f575b601f0160051c01905b818110610274575061011e565b5f8155600101610267565b909150819061025e565b634e487b7160e01b5f52604160045260245ffd5b5f80fd5b3461029d57602036600319011261029d576004355f525f60205260405f206001604051916102ce836104a7565b60ff8154161515835201604051905f928154916102ea836104e5565b9081855260208501936001811690815f1461038e5750600114610354575b5050610319836060949503856104c3565b836020820152511515906040519384928352604060208401525180918160408501528484015e5f828201840152601f01601f19168101030190f35b9094505f5260205f205f905b85821061037857508301602001935061031983610308565b6001816020925483858901015201910190610360565b60ff191685525050151560051b8301602001935061031983610308565b3461029d57608036600319011261029d5760043560243567ffffffffffffffff811161029d576103df903690600401610479565b505060643560ff81160361029d57600254905f19821461043f5760016020920180600255604051838101918383526040820152426060820152606081526104276080826104c3565b519020905f52600182528060405f2055604051908152f35b634e487b7160e01b5f52601160045260245ffd5b3461029d57602036600319011261029d576020906004355f526001825260405f20548152f35b9181601f8401121561029d5782359167ffffffffffffffff831161029d576020838186019501011161029d57565b6040810190811067ffffffffffffffff82111761028957604052565b90601f8019910116810190811067ffffffffffffffff82111761028957604052565b90600182811c92168015610513575b60208310146104ff57565b634e487b7160e01b5f52602260045260245ffd5b91607f16916104f456" as `0x${string}`;

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

export const mockFunctionsRouterBytecode = "0x60808060405234601557610634908161001a8239f35b5f80fdfe6080806040526004361015610012575f80fd5b5f905f3560e01c9081631b7d0a2d1461046e57508063461d27621461018a57806347799da8146100695763973a814e1461004a575f80fd5b3461006657806003193601126100665760209054604051908152f35b80fd5b503461006657806003193601126100665767ffffffffffffffff60015416604051908260025490610099826105a6565b80855260208501926001811690811561016f5750600114610119575b506100c58460c0959603866105de565b63ffffffff60035460045492604051978896875260a060208801525180958160a08901528888015e85850187015261ffff8116604086015260101c1660608401526080830152601f01601f19168101030190f35b600282529450807f405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace5b8682106101595750840160200194506100c56100b5565b6001816020925483858a01015201910190610142565b60ff1916845250151560051b840160200194506100c56100b5565b50346100665760a0366003190112610066576004359067ffffffffffffffff82168092036100665760243567ffffffffffffffff811161046a576101d2903690600401610578565b909260443561ffff8116809103610466576064359063ffffffff82168092036104625784545f19811461044e57600101938486556040519360a0850185811067ffffffffffffffff82111761043a57604052845267ffffffffffffffff8111610422576040519661024d601f8301601f1916602001896105de565b818852368282011161043657818792602092838b013788010152856020840152604083019081526060830191825267ffffffffffffffff60808401936084358552511667ffffffffffffffff196001541617600155855167ffffffffffffffff8111610422576102be6002546105a6565b96601f88116103bf575b602097508790601f83116001146103585761ffff93929188918361034d575b50508160011b915f199060031b1c1916176002555b511665ffffffff0000600354925160101b169165ffffffffffff1916171760035551600455807f27b5aea9f5736c02241d8a0272e9ec988ea44cf85c4b4760329431aa196783946040519380a28152f35b015190505f806102e7565b600288528188209190601f198416895b8181106103a8575091600193918561ffff97969410610390575b505050811b016002556102fc565b01515f1960f88460031b161c191690555f8080610382565b92938b600181928786015181550195019301610368565b600287527f405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace601f830160051c81019860208410610418575b601f0160051c01975b88811061040d57506102c8565b878155600101610400565b90985088906103f7565b602486634e487b7160e01b81526041600452fd5b8680fd5b602488634e487b7160e01b81526041600452fd5b602486634e487b7160e01b81526011600452fd5b8480fd5b8380fd5b5080fd5b9050346105745760803660031901126105745760043573ffffffffffffffffffffffffffffffffffffffff81168091036105745760443567ffffffffffffffff8111610574576104c2903690600401610578565b9160643567ffffffffffffffff8111610574576104e3903690600401610578565b823b1561057457856105498195935f979361053784968a967f0ca761750000000000000000000000000000000000000000000000000000000087526024356004880152606060248801526064870191610614565b84810360031901604486015291610614565b03925af180156105695761055b575080f35b61056791505f906105de565b005b6040513d5f823e3d90fd5b5f80fd5b9181601f840112156105745782359167ffffffffffffffff8311610574576020838186019501011161057457565b90600182811c921680156105d4575b60208310146105c057565b634e487b7160e01b5f52602260045260245ffd5b91607f16916105b5565b90601f8019910116810190811067ffffffffffffffff82111761060057604052565b634e487b7160e01b5f52604160045260245ffd5b908060209392818452848401375f828201840152601f01601f191601019056" as `0x${string}`;

export const mockEASAbi = [
  {
    "type": "function",
    "name": "attest",
    "inputs": [
      {
        "name": "request",
        "type": "tuple",
        "internalType": "struct AttestationRequest",
        "components": [
          {
            "name": "schema",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "data",
            "type": "tuple",
            "internalType": "struct AttestationRequestData",
            "components": [
              {
                "name": "recipient",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "expirationTime",
                "type": "uint64",
                "internalType": "uint64"
              },
              {
                "name": "revocable",
                "type": "bool",
                "internalType": "bool"
              },
              {
                "name": "refUID",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "data",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "value",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "uid",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "getAttestation",
    "inputs": [
      {
        "name": "uid",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Attestation",
        "components": [
          {
            "name": "uid",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "schema",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "time",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "expirationTime",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "revocationTime",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "refUID",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "recipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "attester",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "revocable",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "data",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isAttestationValid",
    "inputs": [
      {
        "name": "uid",
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
    "name": "revoke",
    "inputs": [
      {
        "name": "schema",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "uid",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Attested",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "attester",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "uid",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "schema",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Revoked",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "attester",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "uid",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "schema",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  }
] as const;

export const mockEASBytecode = "0x60808060405234601557610bf8908161001a8239f35b5f80fdfe6080806040526004361015610012575f80fd5b5f3560e01c908163a3112a641461073b57508063c266461014610552578063e30bb5631461052a5763f17325e714610048575f80fd5b60203660031901126105125760043567ffffffffffffffff81116105125760406003198236030112610512576001545f198114610516576001018060015560e06100ff6100a861009e6024860186600401610b9c565b6080810190610bb1565b9290936040519384918160208401978960040135895233604086015260a060608601528160c0860152858501375f84838501015260808301524260a0830152601f801991011681010301601f1981018352826109ad565b51902060206101146024840184600401610b9c565b01359167ffffffffffffffff831680930361051257606061013b6024830183600401610b9c565b01356101556101506024840184600401610b9c565b610be4565b9360406101686024850185600401610b9c565b0135918215158093036105125761018861009e6024860186600401610b9c565b9290966040519261019884610990565b8784526020840194876004013586526040850167ffffffffffffffff421681526060860194855260808601975f895260a087019384526001600160a01b0360c08801951685523360e088015261010087015267ffffffffffffffff82116104fe576040519a610211601f8401601f19166020018d6109ad565b828c523683820111610512576006986001600160a01b03965f60208f96878167ffffffffffffffff97846102f49b013701015261012089019d8e528c5f525f60205260405f209989518b555160018b01558260028b019451167fffffffffffffffffffffffffffffffff000000000000000000000000000000006fffffffffffffffff00000000000000008654935160401b1692161717835551167fffffffffffffffff0000000000000000ffffffffffffffffffffffffffffffff77ffffffffffffffff0000000000000000000000000000000083549260801b169116179055565b51600385015551166001600160a01b0360048401911673ffffffffffffffffffffffffffffffffffffffff1982541617905561010060058301916001600160a01b038060e0830151161673ffffffffffffffffffffffffffffffffffffffff19845416178355015115157fffffffffffffffffffffff00ffffffffffffffffffffffffffffffffffffffff74ff000000000000000000000000000000000000000083549260a01b16911617905501925192835167ffffffffffffffff81116104fe576103c082546109cf565b601f81116104b9575b50806020958690601f8311600114610457575f9261044c575b50508160011b915f199060031b1c19161790555b6001600160a01b036104116101506024840184600401610b9c565b16906040519083825260040135917f8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35853393a4604051908152f35b015190505f806103e2565b5f8581528281209350601f198516905b8181106104a2575090846001959493921061048a575b505050811b0190556103f6565b01515f1960f88460031b161c191690555f808061047d565b929389600181928786015181550195019301610467565b825f5260205f20601f830160051c810191602084106104f4575b601f0160051c01905b8181106104e957506103c9565b5f81556001016104dc565b90915081906104d3565b634e487b7160e01b5f52604160045260245ffd5b5f80fd5b634e487b7160e01b5f52601160045260245ffd5b34610512576020366003190112610512576020610548600435610a07565b6040519015158152f35b3461051257604036600319011261051257600435602435805f525f60205260405f208054156106f7576005810154336001600160a01b038216036106b3578360018301540361066f5760a01c60ff161561062b576002810180547fffffffffffffffff0000000000000000ffffffffffffffffffffffffffffffff164260801b77ffffffffffffffff00000000000000000000000000000000161790556001600160a01b039060040154166040519182527ff930a6e2523c9cc298691873087a740550b8fc85a0680830414c148ed927f61560203393a4005b606460405162461bcd60e51b815260206004820152601660248201527f4d6f636b4541533a206e6f74207265766f6361626c65000000000000000000006044820152fd5b606460405162461bcd60e51b815260206004820152601860248201527f4d6f636b4541533a20736368656d61206d69736d6174636800000000000000006044820152fd5b606460405162461bcd60e51b815260206004820152601560248201527f4d6f636b4541533a206e6f7420617474657374657200000000000000000000006044820152fd5b606460405162461bcd60e51b815260206004820152601460248201527f4d6f636b4541533a20756e6b6e6f776e207569640000000000000000000000006044820152fd5b34610512576020366003190112610512576101208161075b606093610990565b5f81525f60208201525f60408201525f838201525f60808201525f60a08201525f60c08201525f60e08201525f61010082015201526004355f525f60205260405f206040516107a981610990565b81548152600182015491602082019283526002810154604083019167ffffffffffffffff82168352606084019167ffffffffffffffff8160401c16835267ffffffffffffffff608086019160801c168152600382015460a086019081526001600160a01b036004840154169160c08701928352600584015494600660e08901956001600160a01b038816875260ff6101008b019860a01c1615158852019660405180985f9080549061085a826109cf565b80855291600181169081156109725750600114610936575b50500361087f90896109ad565b6101208901978852604051998a9960208b525160208b01525160408a01525167ffffffffffffffff1660608901525167ffffffffffffffff1660808801525167ffffffffffffffff1660a08701525160c0860152516001600160a01b031660e0850152516001600160a01b03166101008401525115156101208301525161014082016101409052805180918161016085015260200161018084015e808201610180015f9052601f1990601f01168101036101800190f35b5f908152602081209092505b81831061095757505081016020018c80610872565b80602092948385600194549201015201910190918a92610942565b9150506020925060ff191682840152151560051b8201018c80610872565b610140810190811067ffffffffffffffff8211176104fe57604052565b90601f8019910116810190811067ffffffffffffffff8211176104fe57604052565b90600182811c921680156109fd575b60208310146109e957565b634e487b7160e01b5f52602260045260245ffd5b91607f16916109de565b5f525f60205260405f20604051610a1d81610990565b815481526001820154602082015260028201549067ffffffffffffffff821660408201526006606082019367ffffffffffffffff8460401c16855267ffffffffffffffff608084019460801c168452600381015460a08401526001600160a01b0360048201541660c084015260ff60058201546001600160a01b03811660e086015260a01c1615156101008401520160405190815f825492610abe846109cf565b8084529360018116908115610b7a5750600114610b36575b50610ae3925003826109ad565b6101208201525115610b30575167ffffffffffffffff16610b2b575167ffffffffffffffff168015159081610b21575b50610b1d57600190565b5f90565b905042115f610b13565b505f90565b50505f90565b90505f9291925260205f20905f915b818310610b5e575050906020610ae3928201015f610ad6565b6020919350806001915483858801015201910190918392610b45565b905060209250610ae394915060ff191682840152151560051b8201015f610ad6565b90359060be1981360301821215610512570190565b903590601e1981360301821215610512570180359067ffffffffffffffff82116105125760200191813603831361051257565b356001600160a01b0381168103610512579056" as `0x${string}`;
