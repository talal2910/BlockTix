export function getEffectiveTicketPrice(event) {
  const earlyBird = event?.earlyBird;
  const earlyBirdActive =
    earlyBird?.enabled &&
    earlyBird?.endDate &&
    new Date() <= new Date(earlyBird.endDate) &&
    typeof earlyBird.maxTickets === "number" &&
    (earlyBird.soldCount || 0) < earlyBird.maxTickets;

  return {
    price: earlyBirdActive ? earlyBird.discountPrice : event.price,
    earlyBirdActive,
  };
}
