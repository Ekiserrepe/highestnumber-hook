// README & more info: https://github.com/Ekiserrepe/highestnumber-hook
import {sfAccount, sfDestination} from "sfcodes.ts";
import {ttPAYMENT, ttINVOKE} from "tts.ts";

export const Hook = () => {

    // Create a reserve for 2 outgoing transactions
    etxn_reserve(2)

    // Check hook account
    const hook_accid=hook_account() as number[]

    // Check the sender of the initial txn
    const acc_id=otxn_field(sfAccount) as number[]

    // Check destination of the initial txn
    const account_field = otxn_field(sfDestination) as number[]

    // Checking if hook_accid and account_field are the same
    const equal = JSON.stringify(hook_accid) == JSON.stringify(account_field) ? 1 : 0;

    // To know the txn type
    const tt = otxn_type()


    //Function to translate from byte to str
    const byte2str = (bytes: number[]) => {
        return bytes.map(byte => String.fromCharCode(byte)).join('')
    }

    // Hook params
    //FUNDS is translated to HEX like 46554E44, we add 0x each 2 digits
    const fund_param = [0x46, 0x55, 0x4E, 0x44]
    //P1LG is translated to HEX like 50314C47
    const p1ledger_param = [0x50, 0x31, 0x4C, 0x47]
    //P1AD is translated to HEX like 50314144
    const p1address_param = [0x50, 0x31, 0x41, 0x44]


    // Get FUND Address from namespace
    const fundaddress_ns=state(fund_param)

    //Check if fundaddress is the origin payment account or the destination
    const sender_equal = JSON.stringify(acc_id) == JSON.stringify(fundaddress_ns) ? 1 : 0
    const destination_equal = JSON.stringify(account_field) == JSON.stringify(fundaddress_ns) ? 1 : 0

    //Check namespace's addresses
    const p1address_ns = state(p1address_param)

    // Check if the second player and first player are the same
    const players_equal = JSON.stringify(p1address_ns) == JSON.stringify(acc_id) ? 1 : 0

    //Get ledger sequence
    const seq = ledger_seq()
    //const lastDigit = seq % 10
    const last_digit= (seq % 10).toString(16).toUpperCase().padStart(2, "0")

    // Get first player last digit if exists
    const p1_digit= state(p1ledger_param).toString(16).toUpperCase().padStart(2, "0")

    //Check json Txn
    const txn = otxn_json() as Transaction

    // Check there is a fund_param value
    const fundaddress_hp =otxn_param(fund_param)

    //If i want to add the funding account
    if (!equal && fundaddress_hp.length==20 && tt==ttINVOKE) {
        state_set(fundaddress_hp, fund_param)
        accept("Highest: Adding fund account.", 1)
    }
    //I want to allow the fund account send payments and receiving from hook account, sender_equal and destination_equal check if the account is the FUND one stored in our namespace.
    if (tt==ttPAYMENT && ( sender_equal || destination_equal)) {
        accept("Highest: Funding account payment.", 2)
    }

    // If It's not XAH (other tokens), (Explanation: txn.Amount will be number type for XAH, object for IOUs)
    if (tt==ttPAYMENT && typeof txn.Amount.length === "undefined"){
        rollback("Highest: Not accepting IOUs or transaction type.", 3);
    } 
    // We keep the amount of XAH for later
    const drops_sent = txn.Amount
    
//If first player payment goes right, to check that, you need an incoming payment from another account (equal=1), it has to be a payment (tt==ttPAYMENT or tt==0), the amount has to be 1 XAH (drops_sent==1000000) and be the first player to enter to the game, no previous records of player in the namespace p1address_ns.length != 20
    if (equal && p1address_ns.length != 20 && tt==ttPAYMENT && drops_sent==1000000) {
        state_set(last_digit, p1ledger_param)
        state_set(acc_id, p1address_param)
        accept("Highest: Saving first player.", 4)
    }
    //I check if there is a second payment from different account than first player (!players_equal), its a payment tt==00 or tt==ttPAYMENT and 1 XAH drops_sent==1000000
    if (equal && p1address_ns.length == 20 && !players_equal && tt==ttPAYMENT && drops_sent==1000000) {
        //If P2 Wins, we send 2 XAH to P2
        if(last_digit>p1_digit){
            //Let's create the outgoing payment
            const prepared_txn = prepare({
                TransactionType: "Payment",
                Destination: util_raddr(acc_id),
                Amount: parseFloat(drops_sent)*2
            })
            const emit_result01=emit(prepared_txn)
        }
        //If P1 Wins we send 2 XAH to P1
        if(last_digit<p1_digit){
            //Let's create the outgoing payment
            const prepared_txn = prepare({
                TransactionType: "Payment",
                Destination: util_raddr(p1address_ns),
                Amount: parseFloat(drops_sent)*2
            })
            const emit_result01=emit(prepared_txn)
        }
        //If there is a draw, we send 1 XAH to each player (2 payments)
        if(last_digit==p1_digit){
            //Let's create the outgoing payment
            const prepared_txn1 = prepare({
                TransactionType: "Payment",
                Destination: util_raddr(acc_id),
                Amount: parseFloat(drops_sent)
            })
            //Let's create the outgoing payment
            const prepared_txn2 = prepare({
                TransactionType: "Payment",
                Destination: util_raddr(p1address_ns),
                Amount: parseFloat(drops_sent)
            })
            const emit_result01=emit(prepared_txn1)
            const emit_result02=emit(prepared_txn2) 
        }
        //Deleting P1 values from namespace, so we can restart the game later
        state_set(null,p1ledger_param)
        state_set(null,p1address_param)
        accept("Highest: End of the game.", 3)
    }

    rollback("Highest: Not accepting this transaction.", 5)
    
    return 0
}