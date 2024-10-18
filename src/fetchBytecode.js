// const {Web3} = require('web3');

// // Create a new instance of Web3 with the HttpProvider
// const web3 = new Web3('https://gtc-dataseed.gtcscan.io');



// // Function to fetch contract address from a transaction hash
// async function getContractAddressFromTxHash(txHash) {
//     try {
//         const receipt = await web3.eth.getTransactionReceipt(txHash);
        
//         if (receipt && receipt.contractAddress) {
//             console.log('Contract Address:', receipt.contractAddress);
//             return receipt.contractAddress;
//         } else {
//             console.error('No contract address found for this transaction hash.');
//             return null;
//         }
//     } catch (error) {
//         console.error('Error fetching transaction receipt:', error);
//         return null;
//     }
// }

// // Function to fetch on-chain bytecode
// async function getOnChainBytecode(contractAddress) {
//     try {
//         const bytecode = await web3.eth.getCode(contractAddress);
//         console.log('On-Chain Bytecode:', bytecode);
//         return bytecode;
//     } catch (error) {
//         console.error('Error fetching on-chain bytecode:', error);
//         return null;
//     }
// }

// // Example: Replace with an actual transaction hash of a contract creation
// // const txHash = '0x8946019549c6286678b39881c0440a33f9de4d6e19f33945d5a9e8c4f7b5f82d';  // Replace with an actual transaction hash
// // const txHash ="0x68675cf30e7e0b8455b08b0bb362a3a47762d3ff8b005aa8885210bf3a366b22"
// const txHash="0xabe5e5d3b0d183e122d619c35b967ca010a6c8adfc314e1a5cc7d893edafaec8"

// // Fetch the contract address from the transaction hash and then fetch the bytecode
// getContractAddressFromTxHash(txHash).then(contractAddress => {
//     if (contractAddress) {
//         return getOnChainBytecode(contractAddress);
//     }
// }).catch(err => {
//     console.error('Error:', err);
// });

// module.exports = { getContractAddressFromTxHash, getOnChainBytecode };





const {Web3} = require('web3');
const web3 = new Web3('https://gtc-dataseed.gtcscan.io');

async function getContractAddressFromTxHash(txHash) {
    try {
        const receipt = await web3.eth.getTransactionReceipt(txHash);
        if (receipt && receipt.contractAddress) {
            console.log('Contract Address:', receipt.contractAddress);
            return receipt.contractAddress;
        } else {
            console.error('No contract address found for this transaction hash.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching transaction receipt:', error);
        return null;
    }
}

async function getOnChainBytecode(contractAddress) {
    try {
        const bytecode = await web3.eth.getCode(contractAddress);
        console.log('On-Chain Bytecode:', bytecode);
        return bytecode;
    } catch (error) {
        console.error('Error fetching on-chain bytecode:', error);
        return null;
    }
}

// Get transaction hash from command line argument
const txHash = process.argv[2];

getContractAddressFromTxHash(txHash).then(contractAddress => {
    if (contractAddress) {
        return getOnChainBytecode(contractAddress).then(onChainBytecode => {
            if (onChainBytecode) {
                // Save the bytecode to compare later
                const { exec } = require("child_process");
                exec(`node src/compareBytecode.js ${onChainBytecode}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error comparing bytecode: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.error(`Error output: ${stderr}`);
                        return;
                    }
                    console.log(`Comparison output: ${stdout}`);
                });
            }
        });
    }
});
