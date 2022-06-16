import { UnknownVersionError } from '../../../common/errors'
import { encodeId, getOriginAccountId } from '../../../common/tools'
import { PayeeType } from '../../../model'
import { StakingSetPayeeCall } from '../../../types/generated/calls'
import { CallContext, CallHandlerContext } from '../../types/contexts'
import { getOrCreateAccount, getOrCreateStaker } from '../../util/entities'

export interface CallData {
    payee: string
    account?: Uint8Array
}

function getCallData(ctx: CallContext): CallData {
    const call = new StakingSetPayeeCall(ctx)

    if (call.isV0) {
        const { payee } = call.asV0
        return {
            payee: payee.__kind,
            account: (payee as { value: Uint8Array }).value,
        }
    } else if (call.isV9110) {
        const { payee } = call.asV9110
        return {
            payee: payee.__kind,
            account: (payee as { value: Uint8Array }).value,
        }
    } else {
        throw new UnknownVersionError(call.constructor.name)
    }
}

export async function handleSetPayee(ctx: CallHandlerContext) {
    const data = getCallData(ctx)

    const controllerId = getOriginAccountId(ctx.call.origin)

    const staker = await getOrCreateStaker(ctx, 'Controller', controllerId)
    if (!staker) throw new Error(`Missing staking info for ${controllerId}`)

    const payee = data.account ? encodeId(data.account) : null

    switch (data.payee) {
        case 'Account':
            staker.payeeType = PayeeType.Account
            staker.payee = payee ? await getOrCreateAccount(ctx, payee) : null
            break
        case 'Stash':
            staker.payeeType = PayeeType.Stash
            staker.payee = staker.stash
            break
        case 'Staked':
            staker.payeeType = PayeeType.Staked
            staker.payee = staker.stash
        case 'Controller':
            staker.payeeType = PayeeType.Controller
            staker.payee = staker.controller
            break
        case 'None': {
            staker.payeeType = PayeeType.None
            staker.payee = undefined
            break
        }
        default:
            throw new Error(`Unknown payee type ${data.payee}`)
    }

    await ctx.store.save(staker)
}
