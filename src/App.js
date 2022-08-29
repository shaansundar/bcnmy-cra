import { Biconomy } from "@biconomy/mexa";
import { useEffect, useState } from "react";
import TimeLockABI from "./TimeLock.json";
import "./App.css";
import { ethers } from "ethers";
import { toBuffer } from "ethereumjs-util";
// let sigUtil = require("eth-sig-util"); // additional dependency

import {
  helperAttributes,
  getDomainSeperator,
  getDataToSignForPersonalSign,
  getDataToSignForEIP712,
  buildForwardTxRequest,
  getBiconomyForwarderConfig,
} from "./biconomyForwarderHelpers";

let abi = require("ethereumjs-abi");

// import { toBuffer } from "ethereumjs-util";
// let abi = require("ethereumjs-abi");

const ABI = TimeLockABI.abi;
const BICONOMY_SDK_API = "lkBTYDscX.e3ca222b-eb4f-434e-9f89-7bb370c4b562";
const TIMELOCK_ADDRESS = "0x85FADc6c0a518c2383680be52a6839c98C9A133d";

function App() {
  const { ethereum } = window;
  const [account, setAccount] = useState(null);
  const [currentDeposit, setCurrentDeposit] = useState(0);
  const [value, setvalue] = useState("");
  const [contract, setcontract] = useState();
  const [bcnmyContract, setbcnmyContract] = useState();
  const [bcnmyObject, setbcnmyObject] = useState();
  const [ethersProvider, setethersProvider] = useState();
  const [ethersSigner, setethersSigner] = useState();
  const [contractInterface, setinterface] = useState();
  const [loading, setloading] = useState(false);

  const fetchContract = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    console.log(provider);
    const signer = await provider.getSigner();
    console.log(signer);
    const timelockContract = new ethers.Contract(TIMELOCK_ADDRESS, ABI, signer);

    setethersProvider(provider);
    setethersSigner(signer);
    setcontract(timelockContract);
    // await bicoinit();
    await getData();
  };

  async function bicoinit() {
    try {
      const { ethereum } = window;
      const biconomy = new Biconomy(ethereum, {
        apiKey: BICONOMY_SDK_API,
        debug: true,
        contractAddresses: [TIMELOCK_ADDRESS], // list of contract address you want to enable gasless on
      });
      const contractInstance = new ethers.Contract(
        TIMELOCK_ADDRESS,
        ABI,
        biconomy.ethersProvider
      );
      await biconomy.init();
      if (biconomy == undefined) {
        await bicoinit();
      }
      setbcnmyObject(biconomy);
      setbcnmyContract(contractInstance);
      console.log("Biconomy Object: ", bcnmyObject);
    } catch (error) {
      alert(error);
    }
  }

  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log("Connected", accounts[0]);
      setAccount(accounts[0]);
    } catch (error) {
      alert(error);
    }
  };

  const getData = async () => {
    let etherBalance = await contract.depositData(
      account,
      ethers.constants.AddressZero
    );
    setCurrentDeposit(etherBalance / 10 ** 18);
    setloading(false);
  };

  const deposit = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    console.log(provider);
    const signer = await provider.getSigner();
    console.log(signer);
    const timelockContract = new ethers.Contract(TIMELOCK_ADDRESS, ABI, signer);
    setloading(true);
    console.log(contract);
    if (value > 0) {
      try {
        console.log(value);
        var txHash = await timelockContract.depositEther({
          value: ethers.utils.parseEther(value),
        });
        await txHash.wait();
        alert("DEPOSIT SUCCESS");
      } catch (e) {
        alert("FAILURE");
        console.log(e);
      }
    } else {
      alert("ENTER A VALID AMOUNT OF ETH");
    }
    setloading(false);
  };

  const getSignatureParametersEthers = (signature) => {
    if (!ethers.utils.isHexString(signature)) {
      throw new Error(
        'Given value "'.concat(signature, '" is not a valid hex string.')
      );
    }
    const r = signature.slice(0, 66);
    const s = "0x".concat(signature.slice(66, 130));
    let v = "0x".concat(signature.slice(130, 132));
    v = ethers.BigNumber.from(v).toString();
    if (![27, 28].includes(Number(v))) v += 27;
    return {
      r: r,
      s: s,
      v: Number(v),
    };
  };

  const withdrawAPI = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    console.log(provider);
    const signer = await provider.getSigner();
    console.log(signer);
    const timelockContract = new ethers.Contract(TIMELOCK_ADDRESS, ABI, signer);
    let contractInterface = new ethers.utils.Interface(ABI);

    //

    let voucher = {
      user: account,
      token: ethers.constants.AddressZero,
      amount: ethers.utils.parseEther(`${value}`),
    };
    const hashedVoucher = await timelockContract.getVoucherHash({
      ...voucher,
      signature: 0,
    });
    console.log(hashedVoucher);
    const userSignature = await signer.signMessage(
      ethers.utils.arrayify(hashedVoucher)
    );

    //

    let functionSignature = contractInterface.encodeFunctionData(
      "withdrawWithVoucher",
      [{ ...voucher, signature: userSignature }]
    );
    let gasPrice = await provider.getGasPrice();
    let gasLimit = await provider.estimateGas({
      to: TIMELOCK_ADDRESS,
      from: account,
      data: functionSignature,
    });
    let forwarder = await getBiconomyForwarderConfig(80001);
    let forwarderContract = new ethers.Contract(
      forwarder.address,
      forwarder.abi,
      signer
    );
    const batchNonce = await forwarderContract.getNonce(account, 0);
    //const batchId = await forwarderContract.getBatch(account);
    const gasLimitNum = Number(gasLimit.toNumber().toString());
    const request = await buildForwardTxRequest({
      account: account,
      to: TIMELOCK_ADDRESS,
      gasLimitNum: gasLimitNum,
      batchId: "0",
      batchNonce: batchNonce,
      data: functionSignature,
    });
    const domainSeparator = await getDomainSeperator(80001);
    const dataToSign = await getDataToSignForEIP712(request, 80001);

    let sig;
    provider
      .send("eth_signTypedData_v3", [account, dataToSign])
      .then(function (sig) {
        sendTransaction({
          request: request,
          domainSeparator: domainSeparator,
          sig: sig,
          signatureType: bcnmyObject.eip712sign,
        });
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  const sendTransaction = async ({
    request,
    sig,
    domainSeparator,
    signatureType,
  }) => {
    let params;
    if (domainSeparator) {
      params = [request, domainSeparator, sig];
    } else {
      params = [request, sig];
    }
    console.log(params);
    try {
      fetch(`https://api.biconomy.io/api/v2/meta-tx/native`, {
        method: "POST",
        headers: {
          "x-api-key": BICONOMY_SDK_API,
          "Content-Type": "application/json;charset=utf-8",
        },
        body: JSON.stringify({
          to: TIMELOCK_ADDRESS,
          apiId: "cadd2a92-d7b0-4d0c-a349-ea564ac3713b",
          params: params,
          from: account,
          signatureType: "EIP712Sign",
        }),
      })
        .then((response) => response.json())
        .then(async function (result) {
          console.log(result);
          alert(`Transaction sent by relayer with hash ${result.txHash}`);
        })
        .catch(function (error) {
          console.log(error);
        });
    } catch (error) {
      console.log(error);
    }
  };

  const withdrawSDK = async () => {
    const domainType = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
    ];
    const metaTransactionType = [
      { name: "nonce", type: "uint256" },
      { name: "from", type: "address" },
      { name: "functionSignature", type: "bytes" },
    ];
    let domainData = {
      name: "TimeLock",
      version: "V1",
      verifyingContract: TIMELOCK_ADDRESS,
      salt: "0x" + (42).toString(16).padStart(64, "0"),
    };

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    console.log(provider);
    const signer = await provider.getSigner();
    console.log(signer);
    const timelockContract = new ethers.Contract(TIMELOCK_ADDRESS, ABI, signer);
    let contractInterface = new ethers.utils.Interface(ABI);

    //

    let voucher = {
      user: account,
      token: ethers.constants.AddressZero,
      amount: ethers.utils.parseEther(`${value}`),
    };
    const hashedVoucher = await timelockContract.getVoucherHash({
      ...voucher,
      signature: 0,
    });
    console.log(hashedVoucher);
    const userSignature = await signer.signMessage(
      ethers.utils.arrayify(hashedVoucher)
    );

    //

    let functionSignature = contractInterface.encodeFunctionData(
      "withdrawWithVoucher",
      [{ ...voucher, signature: userSignature }]
    );
    let nonce = await timelockContract.getNonce(account);
    let message = {
      nonce: parseInt(nonce),
      from: account,
      functionSignature: functionSignature,
    };

    const dataToSign = JSON.stringify({
      types: {
        EIP712Domain: domainType,
        MetaTransaction: metaTransactionType,
      },
      domain: domainData,
      primaryType: "MetaTransaction",
      message: message,
    });

    let signature = await provider.send("eth_signTypedData_v3", [
      account,
      dataToSign,
    ]);

    let r,s,v;
    if (!ethers.utils.isHexString(signature)) {
        throw new Error(
          'Given value "'.concat(signature, '" is not a valid hex string.')
        );
    }
    const lr = signature.slice(0, 66);
    const ls = "0x".concat(signature.slice(66, 130));
    let lv = "0x".concat(signature.slice(130, 132));
    lv = ethers.BigNumber.from(lv).toString();
    if (![27, 28].includes(Number(lv))) {v += 27};
    r=lr;
    s=ls;
    v=lv;
    let popdata;
      let newdata=
        await bcnmyContract.populateTransaction.executeMetaTransaction(
          account,
          functionSignature,
          r,
          s,
          v
        );
    popdata = newdata.data;
    

    let txParams = {
      data: popdata,
      to: TIMELOCK_ADDRESS,
      from: account,
      signatureType: "EIP712_SIGN",
    };

    console.log(bcnmyObject);
    const bcnmyProvider = await bcnmyObject.provider;

    try{
    let tx = await bcnmyProvider.send("eth_sendTransaction", [txParams]);
    // let tx = await bcnmyProvider.sendTransaction([txParams])
    console.log(tx)
    }catch(error){alert(error)}

    bcnmyObject.on("txHashGenerated", (data) => {
      console.log(data);
      alert(`tx hash ${data.hash}`);
    });

    bcnmyObject.on("txMined", (data) => {
      console.log(data);
    });

    bcnmyObject.on("onError", (data) => {
      console.log(data);
    });

    bcnmyObject.on("txHashChanged", (data) => {
      console.log(data);
    });
  };

  return (
    <>
      {loading ? (
        <div className="container">
          <h1>Loading...</h1>
        </div>
      ) : (
        <div className="container">
          <input
            onChangeCapture={(e) => setvalue(e.target.value)}
            type="number"
            className="textbox"
          />
          {!account || account ? (
            <div style={{ display: "flex" }}>
              <button
                onClick={async () => await connectWallet()}
                className="buttonP"
              >
                Connect Wallet
              </button>
              <button
                onClick={async () => await bicoinit()}
                className="buttonP"
              >
                Init Biconomy
              </button>
              <button
                onClick={async () => await fetchContract()}
                className="buttonP"
              >
                Init Contract
              </button>
            </div>
          ) : (
            <div>
              <h6> Current Deposit: {`${currentDeposit[0] / 10 ** 18}`} </h6>
              <h6> Connected Account: {account} </h6>
            </div>
          )}
          <button onClick={() => deposit()} className="buttonP">
            Deposit
          </button>
          <button onClick={() => withdrawSDK()} className="buttonP">
            Withdraw Gasless
          </button>
        </div>
      )}
    </>
    // <div className="w-screen bg-slate-400 h-screen flex flex-col items-center justify-center">
    //   <button onClick={async () => await bicoinit()}>Init Biconomy</button>
    //   <br />
    //   <br />
    //   <button onClick={() => contractInstance()}>Init Contract</button>
    //   <br />
    //   <br />
    //   <button onClick={() => connectWallet()}>Connect Wallet</button>
    //   <br />
    //   <br />
    //   <button onClick={async () => await sendTx()}>Get 0.1 ETH</button>
    // </div>
  );
}

export default App;
