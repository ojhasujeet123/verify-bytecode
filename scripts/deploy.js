// const hre = require("hardhat");
// const fs = require('fs');
// const path = require('path');

// async function main() {
//   try {
//     await hre.run('compile');

//     console.log("Network name:", hre.network.name);
//     console.log("Network config:", JSON.stringify(hre.config.networks[hre.network.name], null, 2));

//     console.log("Getting signers...");
//     const signers = await hre.ethers.getSigners();
//     console.log(`Number of signers: ${signers.length}`);

//     if (signers.length === 0) {
//       throw new Error("No signers available. Check your network configuration.");
//     }

//     const [deployer] = signers;

//     if (!deployer || !deployer.address) {
//       throw new Error("Deployer account not properly initialized.");
//     }

//     console.log("Deploying contracts with the account:", deployer.address);

//     const balance = await hre.ethers.provider.getBalance(deployer.address);
//     console.log("Account balance:", hre.ethers.formatEther(balance));


//     const MyContract = await hre.ethers.getContractFactory("APS");
//     console.log("Deploying contract...");

//        // Constructor arguments
//        const name = "APS Token";
//        const symbol = "APS";
//        const decimals = 18;
//        const supply = 100000000; // Total supply of 1 million tokens
//        const ownerAddress = deployer.address;

//        console.log("Deploying with parameters:");
//        console.log(`Name: ${name}`);
//        console.log(`Symbol: ${symbol}`);
//        console.log(`Decimals: ${decimals}`);
//        console.log(`Supply: ${supply}`);
//        console.log(`Owner Address: ${ownerAddress}`);
   

//     const myContract = await MyContract.deploy(name, symbol, decimals, supply, ownerAddress);
    
//     console.log("Deployment transaction hash:", myContract.deploymentTransaction().hash);

    

//     const deployedAddress = await myContract.getAddress();
//     console.log("Contract deployed to:", deployedAddress);

//     console.log("Waiting for the transaction to be mined...");
//     await myContract.deploymentTransaction().wait(2); // Wait for 2 confirmations

//     console.log("Attempting to retrieve on-chain bytecode...");
//     const onChainBytecode = await hre.ethers.provider.getCode(deployedAddress);
//     console.log("Retrieved on-chain bytecode length:", onChainBytecode.length);

//     if (onChainBytecode === '0x') {
//       console.error("Error: Retrieved bytecode is empty. The contract might not be deployed correctly or the network might be experiencing issues.");
//     } else {
//       // Save the on-chain bytecode to a file
//       const bytecodeFilePath = path.join(__dirname, 'onChainBytecode.txt');
//       fs.writeFileSync(bytecodeFilePath, onChainBytecode);
//       console.log("On-chain bytecode saved to:", bytecodeFilePath);
//     }
    
//     console.log("Waiting for deployment to be mined...");
//     await myContract.waitForDeployment();

   
    

//      if (hre.network.name !== "hardhat" && hre.network.name !== "gtc") {
//       console.log("Waiting for block confirmations...");
//       await deploymentReceipt.wait(5); // Wait for 5 block confirmations

//       console.log("Verifying contract on GTCSCAN...");
//       await hre.run("verify:verify", {
//         address: deployedAddress,
//         constructorArguments: [name, symbol, decimals, supply, ownerAddress],
//       });
//     }

//   } catch (error) {
//     console.error("Error in deployment process:", error);
//     process.exit(1);
//   }
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error("Unhandled error:", error);
//     process.exit(1);
//   });



const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    await hre.run('compile');

    console.log("Network name:", hre.network.name);
    console.log("Network config:", JSON.stringify(hre.config.networks[hre.network.name], null, 2));

    console.log("Getting signers...");
    const signers = await hre.ethers.getSigners();
    console.log(`Number of signers: ${signers.length}`);

    if (signers.length === 0) {
      throw new Error("No signers available. Check your network configuration.");
    }

    const [deployer] = signers;

    if (!deployer || !deployer.address) {
      throw new Error("Deployer account not properly initialized.");
    }

    console.log("Deploying contracts with the account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance));


    const MyContract = await hre.ethers.getContractFactory("APS");
    console.log("Deploying contract...");

    // Constructor arguments
    const name = "APS Token";
    const symbol = "APS";
    const decimals = 18;
    const supply = 100000000; // Total supply of 100 million tokens
    const ownerAddress = deployer.address;

    console.log("Deploying with parameters:");
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Supply: ${supply}`);
    console.log(`Owner Address: ${ownerAddress}`);

    // Deploy contract
    const myContract = await MyContract.deploy(name, symbol, decimals, supply, ownerAddress);
    console.log("Contract deployment transaction sent. Waiting for confirmation...");

    // Wait for the transaction to be mined with 2 confirmations
    // const receipt = await myContract.deployTransaction();  // Wait for 2 confirmations
    let tx=await myContract.deploymentTransaction().wait(2); 
    let txHash=tx.hash
    // console.log("Contract deployed, mined in block:", receipt.blockNumber);

    // Get deployed contract address
    const deployedAddress = await myContract.getAddress();
    console.log("Contract deployed to:", deployedAddress);

    // Now use the txHash in the exec call
    const { exec } = require("child_process");
    exec(`node src/fetchBytecode.js ${txHash}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error fetching bytecode: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Error output: ${stderr}`);
            return;
        }
        console.log(`Bytecode fetch output: ${stdout}`);
    });

    console.log("Attempting to retrieve on-chain bytecode...");
    const onChainBytecode = await hre.ethers.provider.getCode(deployedAddress);
    console.log("Retrieved on-chain bytecode length:", onChainBytecode.length);

    if (onChainBytecode === '0x') {
      console.error("Error: Retrieved bytecode is empty. The contract might not be deployed correctly or the network might be experiencing issues.");
    } else {
      // Save the on-chain bytecode to a file
      const bytecodeFilePath = path.join(__dirname, 'onChainBytecode.txt');
      fs.writeFileSync(bytecodeFilePath, onChainBytecode);
      console.log("On-chain bytecode saved to:", bytecodeFilePath);
    }



    if (hre.network.name === "gtc") {
      console.log("Waiting for additional block confirmations...");
      
      // Wait for 5 block confirmations
      const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);      
      // await hre.ethers.provider.waitForTransaction(receipt.hash, 5);
    
      console.log("Verifying contract on GTCScan...");
      await hre.run("verify:verify", {
        address: deployedAddress,
        constructorArguments: [name, symbol, decimals, supply, ownerAddress],
      });
    }
    

  } catch (error) {
    console.error("Error in deployment process:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
