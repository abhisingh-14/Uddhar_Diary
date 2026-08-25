create view person_balances as
select
  p.id as person_id,
  p.user_id,
  p.name,
  coalesce(sum(
    case when d.direction = 'they_owe_you'
      then d.amount_paise - d.amount_paid_paise
      else 0
    end
  ), 0) as they_owe_you_paise,
  coalesce(sum(
    case when d.direction = 'you_owe_them'
      then d.amount_paise - d.amount_paid_paise
      else 0
    end
  ), 0) as you_owe_them_paise,
  coalesce(sum(
    case when d.direction = 'they_owe_you'
      then d.amount_paise - d.amount_paid_paise
      else 0
    end
  ), 0)
  -
  coalesce(sum(
    case when d.direction = 'you_owe_them'
      then d.amount_paise - d.amount_paid_paise
      else 0
    end
  ), 0) as net_balance_paise
from people p
left join debts d on d.person_id = p.id
group by p.id, p.user_id, p.name;