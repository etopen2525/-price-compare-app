const itemsEl = document.querySelector("#items");
const addItemButton = document.querySelector("#addItem");
const resetButton = document.querySelector("#reset");
const resultEl = document.querySelector("#result");
const topResultEl = document.querySelector("#topResult");
const topResultTextEl = document.querySelector("#topResultText");
const winnerTextEl = document.querySelector("#winnerText");
const rankingEl = document.querySelector("#ranking");
const itemTemplate = document.querySelector("#itemTemplate");

const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
const unitMap = {
  "": { group: "none", factor: 1, label: "単位未指定" },
  ml: { group: "volume", factor: 1, label: "ml" },
  l: { group: "volume", factor: 1000, label: "ml" },
  g: { group: "weight", factor: 1, label: "g" },
  kg: { group: "weight", factor: 1000, label: "g" },
  piece: { group: "piece", factor: 1, label: "個" },
  sheet: { group: "sheet", factor: 1, label: "枚" },
  pack: { group: "pack", factor: 1, label: "袋" },
  roll: { group: "roll", factor: 1, label: "ロール" },
};

let itemCount = 0;
let idCount = 0;

function toNumber(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function yen(value) {
  return `${formatNumber(value)}円`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: value < 10 ? 2 : 1,
  }).format(value);
}

function makeItem() {
  const fragment = itemTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".item-card");
  const label = labels[itemCount] || `${itemCount + 1}`;
  card.dataset.itemId = `item-${idCount}`;
  idCount += 1;
  card.querySelector(".item-name").value = `商品${label}`;
  itemCount += 1;

  card.querySelectorAll(".js-field").forEach((field) => {
    field.addEventListener("input", update);
    field.addEventListener("change", update);
    field.addEventListener("keydown", moveToNextField);
  });

  card.querySelectorAll(".point-mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      setPointMode(card, button.dataset.mode);
      update();
    });
  });

  card.querySelector(".remove-button").addEventListener("click", () => {
    card.remove();
    updateRemoveButtons();
    update();
  });

  itemsEl.append(card);
  updateRemoveButtons();
  update();
}

function setPointMode(card, mode) {
  card.dataset.pointMode = mode;
  card.querySelectorAll(".point-mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  const suffix = mode === "percent" ? "%" : "円";
  const placeholder = mode === "percent" ? "例 10" : "例 100";
  card.querySelector(".point-suffix").textContent = suffix;
  card.querySelector(".point").placeholder = placeholder;
}

function setTopResultVisible(isVisible) {
  topResultEl.hidden = !isVisible;
  document.body.classList.toggle("has-top-result", isVisible);
}

function moveToNextField(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();

  const fields = [...document.querySelectorAll(".js-field, #result")].filter((field) => {
    return !field.disabled && field.offsetParent !== null;
  });
  const currentIndex = fields.indexOf(event.currentTarget);
  const next = fields[currentIndex + 1] || fields[0];
  next.focus();
}

function updateRemoveButtons() {
  const cards = [...document.querySelectorAll(".item-card")];
  cards.forEach((card, index) => {
    card.classList.toggle("can-remove", cards.length > 2);
    card.querySelector(".item-number").textContent = circledNumbers[index] || `${index + 1}`;
    card.dataset.itemNumber = circledNumbers[index] || `${index + 1}`;
  });
}

function readCard(card) {
  const name = card.querySelector(".item-name").value.trim() || "未入力の商品";
  const price = toNumber(card.querySelector(".price").value);
  const amount = toNumber(card.querySelector(".amount").value);
  const count = toNumber(card.querySelector(".count").value) ?? 1;
  const point = toNumber(card.querySelector(".point").value) ?? 0;
  const pointMode = card.dataset.pointMode || "amount";
  const unit = card.querySelector(".unit").value;

  if (price === null || price <= 0) {
    return { card, name, valid: false, message: "価格を入力してください" };
  }
  if (count <= 0) {
    return { card, name, valid: false, message: "個数は0より大きくしてください" };
  }
  if (amount !== null && amount <= 0) {
    return { card, name, valid: false, message: "容量は0より大きくしてください" };
  }

  const unitInfo = unitMap[unit];
  const discount = pointMode === "percent" ? price * (point / 100) : point;
  const effectivePrice = Math.max(0, price - discount);
  const baseAmount = amount === null ? 1 : amount * unitInfo.factor;
  const totalAmount = baseAmount * count;
  const unitPrice = effectivePrice / totalAmount;
  const displayUnit = amount === null ? "商品" : unitInfo.label;

  return {
    card,
    number: card.dataset.itemNumber,
    name,
    valid: true,
    effectivePrice,
    totalAmount,
    unitPrice,
    displayUnit,
    group: amount === null ? "item" : unitInfo.group,
  };
}

function update() {
  const items = [...document.querySelectorAll(".item-card")].map(readCard);

  items.forEach((item) => {
    item.card.classList.remove("best");
    item.card.querySelector(".badge").hidden = true;
    item.card.querySelector(".effective").textContent = item.valid ? yen(item.effectivePrice) : "-";
    item.card.querySelector(".unit-price").textContent = item.valid
      ? `${yen(item.unitPrice)} / ${item.displayUnit}`
      : item.message;
  });

  const validItems = items.filter((item) => item.valid);
  if (validItems.length < 2) {
    setTopResultVisible(false);
    winnerTextEl.textContent = "2つ以上の価格を入力してください";
    rankingEl.innerHTML = `<p class="message">入力すると自動で比較します。</p>`;
    return;
  }

  const groups = new Set(validItems.map((item) => item.group));
  if (groups.size > 1) {
    setTopResultVisible(false);
    winnerTextEl.textContent = "単位が違うため比較できません";
    rankingEl.innerHTML = `<p class="message">同じ種類の単位を選ぶか、単位を未入力にそろえてください。</p>`;
    return;
  }

  const ranked = [...validItems].sort((a, b) => a.unitPrice - b.unitPrice);
  const winner = ranked[0];
  winner.card.classList.add("best");
  winner.card.querySelector(".badge").hidden = false;

  topResultTextEl.textContent = `${winner.number} ${winner.name} が一番安いです`;
  setTopResultVisible(true);
  winnerTextEl.textContent = `一番お得: ${winner.number} ${winner.name}`;
  rankingEl.innerHTML = ranked
    .map((item, index) => {
      const diff = item.unitPrice - winner.unitPrice;
      const suffix = index === 0 ? "最安" : `+${yen(diff)} / ${item.displayUnit}`;
      return `
        <div class="ranking-row">
          <strong>${item.number} ${escapeHtml(item.name)}</strong>
          <span>${yen(item.unitPrice)} / ${item.displayUnit} (${suffix})</span>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function reset() {
  itemsEl.innerHTML = "";
  itemCount = 0;
  idCount = 0;
  makeItem();
  makeItem();
  const firstPrice = document.querySelector(".price");
  firstPrice?.focus();
}

addItemButton.addEventListener("click", () => {
  makeItem();
  const cards = document.querySelectorAll(".item-card");
  cards[cards.length - 1].querySelector(".price").focus();
});

resetButton.addEventListener("click", reset);

reset();
