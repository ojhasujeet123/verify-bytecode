const express = require('express')
const hardhat = require('hardhat')
const ethers = require('ethers')
const keccak256 = require('keccak256');
const fs = require('fs').promises
const path = require('path')
const { Web3 } = require('web3');
const { get } = require('https');
const app = express()
app.use(express.json())
const port = 8080


const web3 = new Web3("https://gtc-dataseed.gtcscan.io/")



/*-----------------------------------
get on chain bytecode through contract 
address
 -----------------------------------*/

const getOnChainBytecode = async (contractAddress) => {

    try {
        const deployedBytecode = await web3.eth.getCode(contractAddress)
        return deployedBytecode
    } catch (error) {
        console.error("Error fetching on-chain bytecode ", error)
    }
}








/*-----------------------------------
source code compilation with hardhat 
 -----------------------------------*/

async function compileSourceCodeWithHardhat(sourceCode, compilerVersion) {
    try {
        const mainContract = await findMainContract(sourceCode)
        console.log("mainContract...........",mainContract);
        
        const tempDir = path.join(__dirname, 'contracts')
        await fs.mkdir(tempDir, { recursive: true })

        const filename = `Contract_${Date.now()}.sol`
        const contractPath = path.join(tempDir, filename)
        console.log("contractPath.....", contractPath);

        await fs.writeFile(contractPath, sourceCode)

        await hardhat.run('compile', {
            quite: true
        })

        const artifactsDir = path.join(__dirname, 'artifacts', 'contracts')
        console.log("artifactsDir............", artifactsDir);

        const folders = await fs.readdir(artifactsDir)
        console.log("folders......", folders);

        const matchingFolder = folders.find(folder => folder === filename)
        console.log("matchingFolder.......", matchingFolder);

        if (!matchingFolder) {
            throw new Error(`No folder found with the name ${filename}`)
        }

        const jsonFiles = await fs.readdir(path.join(artifactsDir, matchingFolder))
        const jsonFilesFiltered = jsonFiles.filter(file => file.endsWith('.json') && !file.endsWith('.dbg.json'))
        console.log("jsonFilesFiltered.....", jsonFilesFiltered);
        const mainContractJsonFile = jsonFilesFiltered.find(file => file === `${mainContract}.json`);
        console.log("mainContractJsonFile");
        

        const artifactFile = mainContractJsonFile
        if (!artifactFile) {
            throw new Error('No artifact file found ')
        }

        const artifactFilePath = path.join(artifactsDir, matchingFolder, artifactFile);
        const jsonContent = await fs.readFile(artifactFilePath, 'utf8')
        const jsonArtifact = JSON.parse(jsonContent)
        const artifact = {
            deployedBytecode: jsonArtifact.deployedBytecode,
            jsonArtifact
        }
        return artifact
    } catch (error) {
        console.error('Error compiling source code ', error);
        return null

    }
}











/*-----------------------------------
Extract selectotrs through abi
 -----------------------------------*/


function extractFunctionSelectorsFromABI(abi) {
    return abi
        .filter(item => item.type === 'function')
        .map(fn => {
            const functionSignature = `${fn.name}(${fn.inputs.map(i => i.type).join(',')})`;
            const hash = keccak256(functionSignature); // Get the keccak256 hash

            // Get the first 4 bytes (32 bits) as selector
            // Convert hash to Buffer if it's not already
            const bufferHash = Buffer.isBuffer(hash) ? hash : Buffer.from(hash.slice(2), 'hex');
            const selectorBuffer = bufferHash.subarray(0, 4); // Get first 4 bytes

            // Convert back to hex string
            return `0x${selectorBuffer.toString('hex')}`;
        });
}










/*-----------------------------------
Extract selectotrs through bytecode
 -----------------------------------*/

function extractFunctionSelectorsFromBytecode(bytecode) {
    const selectors = new Set();
    const cleanBytecode = bytecode.replace(/^0x/, '');

    // Ensure the bytecode is a multiple of 2 (even length for valid hex)
    if (cleanBytecode.length % 2 !== 0) {
        throw new Error('Invalid bytecode: odd length');
    }

    for (let i = 0; i < cleanBytecode.length; i += 2) { // Step by 2 characters (1 byte)
        const hexPair = cleanBytecode.slice(i, i + 8); // Extract 8 characters (4 bytes)
        if (hexPair.length === 8) {
            selectors.add(`0x${hexPair}`);
        }
    }

    return selectors;
}











/*---------------------------------------
compare of selectors with abi selectors
----------------------------------------*/
function compareSelectors(abiSelectors, bytecodeSelectors) {
    const matchedSelectors = abiSelectors.filter(sel => bytecodeSelectors.has(sel));
    const matchCount = matchedSelectors.length;
    const totalCount = abiSelectors.length;
    const requiredMatches = Math.ceil(totalCount * 0.8); // Calculate 80% of total selectors

    return {
        isMatch: matchCount >= requiredMatches,
        unmatchedSelectors: matchedSelectors.length === totalCount ? [] : abiSelectors.filter(sel => !bytecodeSelectors.has(sel)),
        matchedCount: matchCount,
        requiredMatches: requiredMatches
    };
}







/*--------------------------------------------------------
After extracting abi selectors,local bytecode selectors &
on chain bytecode selectors , compare both with abi selectors
 -----------------------------------------------------------*/

function verifyBytecode(abiSelectors, localBytecodeSelectors, onChainBytecodeSelectors) {
    const localMatch = compareSelectors(abiSelectors, localBytecodeSelectors);
    console.log("localMatch...", localMatch);

    const onChainMatch = compareSelectors(abiSelectors, onChainBytecodeSelectors);
    console.log("onChainMatch", onChainMatch);

    if (localMatch.isMatch && onChainMatch.isMatch) {
        console.log("Bytecode verification successful. Both local and on-chain bytecodes match the ABI.");

        return true
    } else if (!localMatch && !onChainMatch) {
        console.log("Bytecode verification failed. Neither local nor on-chain bytecodes match the ABI.");

        return false
    } else if (!localMatch) {
        console.log("Bytecode verification failed. Local bytecode does not match the ABI.");

        return false;
    } else {
        console.log("Bytecode verification failed. On-chain bytecode does not match the ABI.");

        return fasle;
    }
}












/*--------------------------------
Api for verify contract
 -----------------------------------*/

app.post('/verify-contract', async (req, res) => {
    const { contractAddress, compilerVersion, licenseType, sourceCode } = req.body
    try {
        const compiledContract = await compileSourceCodeWithHardhat(sourceCode, compilerVersion)
        console.log("compiledContract.............", compiledContract.jsonArtifact.abi);


        if (!compiledContract) {
            return res.status(500).json({ success: false, message: "compilation failed" })
        }

        let onChainBytecode = await getOnChainBytecode(contractAddress)

        const abi = compiledContract.jsonArtifact.abi
        // console.log("abi............", abi);


        const abiSelectors = await extractFunctionSelectorsFromABI(abi)
        console.log("abiSelectors", abiSelectors);

        const onChainBytecodeSelectors = extractFunctionSelectorsFromBytecode(onChainBytecode);
        console.log("onChainBytecodeSelectors", onChainBytecodeSelectors);

        const localBytecodeSelectors = extractFunctionSelectorsFromBytecode(compiledContract.deployedBytecode)
        console.log("localBytecodeSelectors", localBytecodeSelectors);

        const isVerified = await verifyBytecode(abiSelectors, localBytecodeSelectors, onChainBytecodeSelectors)
        console.log("isVerified.....", isVerified);

        const provider = new ethers.JsonRpcProvider("https://gtc-dataseed.gtcscan.io/")
        const functions = await getFunctions(contractAddress, abi, provider)

        if (isVerified) {
            res.json({
                success: true,
                message: "contract verified successfully",
                readFunction: functions.read_function,
                writeFunction: functions.write_function
            })
        } else {
            res.json({ success: false, message: "contract verification failed" })
        }

    } catch (error) {
        console.error('Verification error', error)
        return res.status(500).json({ success: false, message: "internal server error" })
    }
})












/*---------------------------------------
Extract all function of contract
through contract address ,abi & provider
 --------------------------------------*/

async function getFunctions(contractAddress, abi, provider) {
    const contract = new ethers.Contract(contractAddress, abi, provider)
    const functionFragments = contract.interface.fragments.filter((fragment) => fragment.type === 'function')

    const functions = functionFragments.map((fragment) => ({
        name: fragment.name,
        stateMutability: fragment.stateMutability,
        params: fragment.inputs.map((input) => ({
            name: input.name,
            type: input.type
        })
        )
    }))



    const readFunctions = functions.filter((fn) => fn.stateMutability === 'view' || fn.stateMutability === 'pure')

    const writeFunctions = functions.filter((fn) => fn.stateMutability !== 'view' && fn.stateMutability !== 'pure')


    return ({
        read_function: readFunctions,
        write_function: writeFunctions
    })
}





app.listen(port, () => {
    console.log(`server listening on port http://localhost/${port}`)
})











/*--------------------------------
 Extract name from source code 
 -----------------------------------*/
const extractContractNames = (sourceCode) => {
    const contractNameRegex = /contract\s+(\w+)/g;
    let match;
    const contracts = [];
    
    while ((match = contractNameRegex.exec(sourceCode)) !== null) {
        contracts.push(match[1]);
    }
    
    return contracts;
};












/*--------------------------------
 Find main contract throughout
 constructor and inheritance  
 -----------------------------------*/

const findMainContract = (sourceCode) => {
    const contracts = extractContractNames(sourceCode);

    if (contracts.length === 0) {
        throw new Error("No contracts found in the source code.");
    }


    if (contracts.length === 1) {
        return contracts[0];  
    }

    const constructorRegex = /contract\s+(\w+)[^{]*{[^}]*constructor\s*\(/g;
    let mainContract;
    let constructorMatch;
    
    while ((constructorMatch = constructorRegex.exec(sourceCode)) !== null) {
        mainContract = constructorMatch[1];  
    }

    if (!mainContract) {
        const inheritanceRegex = /contract\s+(\w+)\s+is\s+([^\s{]+)/g;
        let inheritanceMatch;
        const inheritedContracts = new Set();
        
        while ((inheritanceMatch = inheritanceRegex.exec(sourceCode)) !== null) {
            inheritedContracts.add(inheritanceMatch[2].split(",")[0]); 
        }

        for (const contract of contracts) {
            if (!inheritedContracts.has(contract)) {
                mainContract = contract;
                break;
            }
        }
    }

    if (!mainContract && contracts.length > 0) {
        mainContract = contracts[contracts.length - 1];  
    }

    return mainContract;
};








// const express = require('express')
// const hardhat = require('hardhat')
// const keccak256 = require('keccak256');
// const fs = require('fs').promises
// const path = require('path')
// const { Web3 } = require('web3')
// const app = express()
// app.use(express.json())
// const port = 8080


// const web3 = new Web3("https://gtc-dataseed.gtcscan.io/")

// const getOnChainBytecode = async (contractAddress) => {

//     try {
//         const deployedBytecode = await web3.eth.getCode(contractAddress)
//         return deployedBytecode
//     } catch (error) {
//         console.error("Error fetching on-chain bytecode ", error)
//     }
// }


// async function compileSourceCodeWithHardhat(sourceCode, compilerVersion) {
//     try {
//         const tempDir = path.join(__dirname, 'contracts')
//         await fs.mkdir(tempDir, { recursive: true })

//         const filename = `Contract_${Date.now()}.sol`
//         const contractPath = path.join(tempDir, filename)
//         console.log("contractPath.....", contractPath);

//         await fs.writeFile(contractPath, sourceCode)

//         await hardhat.run('compile', {
//             quite: true
//         })

//         const artifactsDir = path.join(__dirname, 'artifacts', 'contracts')
//         console.log("artifactsDir............", artifactsDir);

//         const folders = await fs.readdir(artifactsDir)
//         console.log("folders......", folders);

//         const matchingFolder = folders.find(folder => folder === filename)
//         console.log("matchingFolder.......", matchingFolder);

//         if (!matchingFolder) {
//             throw new Error(`No folder found with the name ${filename}`)
//         }

//         const jsonFiles = await fs.readdir(path.join(artifactsDir, matchingFolder))
//         const jsonFilesFiltered = jsonFiles.filter(file => file.endsWith('.json') && !file.endsWith('.dbg.json'))
//         console.log("jsonFilesFiltered.....",jsonFilesFiltered);

//         const artifactFile = jsonFilesFiltered[0]
//         if (!artifactFile) {
//             throw new Error('No artifact file found ')
//         }

//         const artifactFilePath = path.join(artifactsDir, matchingFolder, artifactFile);
//         const jsonContent = await fs.readFile(artifactFilePath, 'utf8')
//         const jsonArtifact = JSON.parse(jsonContent)
//         const artifact = {
//             deployedBytecode: jsonArtifact.deployedBytecode,
//             jsonArtifact
//         }
//         return artifact
//     } catch (error) {
//         console.error('Error compiling source code ', error);
//         return null

//     }
// }

// function extractFunctionSelectorsFromABI(abi) {
//     return abi
//         .filter(item => item.type === 'function')
//         .map(fn => {
//             const functionSignature = `${fn.name}(${fn.inputs.map(i => i.type).join(',')})`;
//             return keccak256(Buffer.from(functionSignature)).toString('hex').slice(0, 8);
//         });
// }

// function extractFunctionSelectorsFromBytecode(bytecode) {
//     const selectors = new Set();
//     const cleanBytecode = bytecode.replace('0x', '');
//     for (let i = 0; i < cleanBytecode.length - 8; i++) {
//         if (cleanBytecode.slice(i, i + 2) === '63') { // PUSH4 opcode
//             selectors.add(cleanBytecode.slice(i + 2, i + 10));
//         }
//     }
//     return Array.from(selectors);
// }

// function compareSelectors(abiSelectors, bytecodeSelectors) {
//     const matchedSelectors = abiSelectors.filter(sel => bytecodeSelectors.includes(sel));
//     return matchedSelectors.length === abiSelectors.length;
// }

// function verifyBytecode(abiSelectors, localBytecodeSelectors, onChainBytecodeSelectors) {
//     const localMatch = compareSelectors(abiSelectors, localBytecodeSelectors);
//     const onChainMatch = compareSelectors(abiSelectors, onChainBytecodeSelectors);

//     if (localMatch && onChainMatch) {
//         return "Bytecode verification successful. Both local and on-chain bytecodes match the ABI.";
//     } else if (!localMatch && !onChainMatch) {
//         return "Bytecode verification failed. Neither local nor on-chain bytecodes match the ABI.";
//     } else if (!localMatch) {
//         return "Bytecode verification failed. Local bytecode does not match the ABI.";
//     } else {
//         return "Bytecode verification failed. On-chain bytecode does not match the ABI.";
//     }
// }




// app.post('/verify-contract', async (req, res) => {
//     const { contractAddress, compilerVersion, licenseType, sourceCode } = req.body
//     try {
//         const compiledContract = await compileSourceCodeWithHardhat(sourceCode, compilerVersion)
//         console.log("compiledContract.............", compiledContract.jsonArtifact.abi);


//         if (!compiledContract) {
//             return res.status(500).json({ success: false, message: "compilation failed" })
//         }

//         let onChainBytecode = await getOnChainBytecode(contractAddress)
//         // console.log("onChainBytecode...............",onChainBytecode);

//         const abi = compiledContract.jsonArtifact.abi
//         console.log("abi............", abi);


//         const abiSelectors = await extractFunctionSelectorsFromABI(abi)
//         const onChainBytecodeSelectors = extractFunctionSelectorsFromBytecode(onChainBytecode);
//         const localBytecodeSelectors = extractFunctionSelectorsFromBytecode(compiledContract.deployedBytecode)
//         const isVerified = await verifyBytecode(abiSelectors, localBytecodeSelectors, onChainBytecodeSelectors)
//         // const provider = new ethers.JsonRpcProvider("https://gtc-dataseed.gtcscan.io/")
//         // const isVerified = await compareAndVerify(compiledContract.deployedBytecode,onChainBytecode)
//         if (isVerified) {
//             res.json({ success: true, message: "contract verified successfully" })
//         } else {
//             res.json({ success: false, message: "contract verification failed" })
//         }
//     } catch (error) {
//         console.error('Verification error', error)
//         return res.status(500).json({ success: false, message: "internal server error" })
//     }
// })












// app.listen(port, () => {
//     console.log(`server listening on port http://localhost/${port}`)
// })




