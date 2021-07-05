import { BigInt } from "@graphprotocol/graph-ts";
import {
  ERC20,
  Approval as ApprovalEvent,
  Transfer as TransferEvent
} from "../generated/ERC20/ERC20";
import {
  Transfer,
  Approval,
  GraphAccount,
  GraphNetwork
} from "../generated/schema";

export function handleApproval(event: ApprovalEvent): void {
  let owner = createOrLoadGraphAccount(event.params.owner.toHexString(), event.block.timestamp);
  let spender = createOrLoadGraphAccount(event.params.spender.toHexString(), event.block.timestamp);

  let approvalId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());
  let approval = new Approval(approvalId);

  approval.owner = owner.id;
  approval.spender = spender.id;
  approval.value = event.params.value;

  approval.blockNumber = event.block.number.toI32();
  approval.blockHash = event.block.hash;
  approval.tx_hash = event.transaction.hash;

  approval.save();
}

export function handleTransfer(event: TransferEvent): void {
  let graphNetwork = getGraphNetwork();

  let to = event.params.to;
  let from = event.params.from;
  let value = event.params.value;
  let userTo = createOrLoadGraphAccount(to.toHexString(), event.block.timestamp);
  let userFrom = createOrLoadGraphAccount(from.toHexString(), event.block.timestamp);

  // no need to do any updates if it was a self transfer
  if (to == from) return;

  // Mint Transfer
  if (from.toHexString() == "0x0000000000000000000000000000000000000000") {
    graphNetwork.totalSupply = graphNetwork.totalSupply.plus(value);
    graphNetwork.totalGRTMinted = graphNetwork.totalGRTMinted.plus(value);
    graphNetwork.save();
    userTo.balance = userTo.balance.plus(value);

    // Burn Transfer
  } else if (to.toHexString() == "0x0000000000000000000000000000000000000000") {
    graphNetwork.totalSupply = graphNetwork.totalSupply.minus(value);
    graphNetwork.totalGRTBurned = graphNetwork.totalGRTBurned.plus(value);
    graphNetwork.save();

    userFrom.balance = userFrom.balance.minus(value);

    // Normal Transfer
  } else {
    userTo.balance = userTo.balance.plus(value);
    userFrom.balance = userFrom.balance.minus(value);
  }

  userTo.save();
  userFrom.save();

  let transferId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());
  let transfer = new Transfer(transferId);

  transfer.to = userTo.id;
  transfer.from = userFrom.id;
  transfer.value = value;

  transfer.blockNumber = event.block.number.toI32();
  transfer.blockHash = event.block.hash;
  transfer.tx_hash = event.transaction.hash;

  transfer.save();
}

export function createOrLoadGraphAccount(id: string, timeStamp: BigInt): GraphAccount {
  let graphAccount = GraphAccount.load(id);
  if (graphAccount == null) {
    graphAccount = new GraphAccount(id);
    graphAccount.createdAt = timeStamp.toI32();
    graphAccount.balance = BigInt.fromI32(0);
    graphAccount.save();
  }
  return graphAccount as GraphAccount;
}

export function getGraphNetwork(): GraphNetwork {
  let network = GraphNetwork.load("1");
  if (network == null) {
    network = new GraphNetwork("1");
    network.totalSupply = BigInt.fromI32(0);
    network.totalGRTMinted = BigInt.fromI32(0);
    network.totalGRTBurned = BigInt.fromI32(0);
    network.save();
  }
  return network as GraphNetwork;
}
